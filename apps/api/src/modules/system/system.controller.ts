import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DockerService } from '../../infrastructure/docker/docker.service';

@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
export class SystemController {
  constructor(private readonly dockerService: DockerService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get API and Docker system status' })
  async status() {
    const [docker, containers] = await Promise.all([
      this.dockerService.getHostInfo(),
      this.dockerService.listAllContainers(),
    ]);

    return {
      api: {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
      docker,
      containers,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('load-balancer')
  @ApiOperation({ summary: 'Get global Traefik load balancer configuration' })
  async loadBalancer() {
    const dynamicDir = process.env.TRAEFIK_DYNAMIC_DIR ?? '/app/traefik-dynamic';
    const filePath = path.join(dynamicDir, 'load-balancer.yml');

    try {
      const [content, files] = await Promise.all([
        fs.readFile(filePath, 'utf8'),
        fs.readdir(dynamicDir).catch(() => []),
      ]);

      return {
        enabled: true,
        path: filePath,
        retryAttempts: this.readNumber(content, /attempts:\s*(\d+)/, 0),
        retryInitialInterval: this.readString(content, /initialInterval:\s*([^\s]+)/, 'disabled'),
        maxInFlightRequests: this.readNumber(content, /amount:\s*(\d+)/, 0),
        maxIdleConnsPerHost: this.readNumber(content, /maxIdleConnsPerHost:\s*(\d+)/, 0),
        dialTimeout: this.readString(content, /dialTimeout:\s*([^\s]+)/, 'default'),
        responseHeaderTimeout: this.readString(content, /responseHeaderTimeout:\s*([^\s]+)/, 'default'),
        idleConnTimeout: this.readString(content, /idleConnTimeout:\s*([^\s]+)/, 'default'),
        managedRoutes: files.filter((name) => /^paas-.+\.ya?ml$/.test(name)).length,
        raw: content,
      };
    } catch {
      return {
        enabled: false,
        path: filePath,
        retryAttempts: 0,
        retryInitialInterval: 'disabled',
        maxInFlightRequests: 0,
        maxIdleConnsPerHost: 0,
        dialTimeout: 'default',
        responseHeaderTimeout: 'default',
        idleConnTimeout: 'default',
        managedRoutes: 0,
        raw: '',
      };
    }
  }

  private readNumber(content: string, pattern: RegExp, fallback: number): number {
    const value = Number(content.match(pattern)?.[1]);
    return Number.isFinite(value) ? value : fallback;
  }

  private readString(content: string, pattern: RegExp, fallback: string): string {
    return content.match(pattern)?.[1] ?? fallback;
  }
}
