import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
