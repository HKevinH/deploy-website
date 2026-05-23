import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { DeploymentsService } from './deployments.service';
import { ServicesService } from '../services/services.service';
import { DockerService } from '../../infrastructure/docker/docker.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DeploymentStatus, ServiceStatus } from '@paas/shared';

@ApiTags('deployments')
@ApiBearerAuth()
@Controller('services/:serviceId/deployments')
export class DeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly servicesService: ServicesService,
    private readonly dockerService: DockerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List deployment history for a service' })
  async findAll(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.deploymentsService.findByService(serviceId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.deploymentsService.findById(id);
  }

  @Post('rollback')
  @ApiOperation({ summary: 'Roll back to the previous successful deployment' })
  async rollback(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.deploymentsService.rollback(serviceId, user.id);
  }

  @Post('start')
  @ApiOperation({ summary: 'Create and start a deployment from the latest successful build' })
  async startLatest(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    await this.servicesService.updateStatus(serviceId, ServiceStatus.DEPLOYING);
    return this.deploymentsService.triggerLatestSuccessfulDeploy(serviceId, user.id);
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Restart the container for a deployment' })
  async restart(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    const deployment = await this.deploymentsService.findById(id);

    if (deployment.containerId) {
      for (const containerId of this.splitContainerIds(deployment.containerId)) {
        await this.dockerService.restartContainer(containerId);
      }
      await this.deploymentsService.updateStatus(id, DeploymentStatus.ACTIVE);
      await this.servicesService.updateStatus(serviceId, ServiceStatus.RUNNING);
    }

    return { restarted: true };
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start the container for a deployment' })
  async start(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    const deployment = await this.deploymentsService.findById(id);

    if (deployment.serviceId !== serviceId) throw new BadRequestException('Deployment does not belong to service');
    if (!deployment.containerId) throw new BadRequestException('No container available for this deployment');

    try {
      for (const containerId of this.splitContainerIds(deployment.containerId)) {
        await this.dockerService.startContainer(containerId);
      }
    } catch (err: any) {
      if (err?.statusCode !== 404) throw err;

      await this.deploymentsService.updateStatus(id, DeploymentStatus.FAILED);
      await this.servicesService.updateActiveDeployment(serviceId, null);
      await this.servicesService.updateStatus(serviceId, ServiceStatus.DEPLOYING);
      return this.deploymentsService.triggerLatestSuccessfulDeploy(serviceId, user.id);
    }

    await this.deploymentsService.updateStatus(id, DeploymentStatus.ACTIVE);
    await this.servicesService.updateStatus(serviceId, ServiceStatus.RUNNING);

    return { started: true };
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop the container for a deployment' })
  async stop(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    const deployment = await this.deploymentsService.findById(id);

    if (deployment.serviceId !== serviceId) throw new BadRequestException('Deployment does not belong to service');
    if (!deployment.containerId) throw new BadRequestException('No container available for this deployment');

    for (const containerId of this.splitContainerIds(deployment.containerId)) {
      await this.dockerService.stopContainer(containerId);
    }
    await this.deploymentsService.updateStatus(id, DeploymentStatus.STOPPED);
    await this.servicesService.updateActiveDeployment(serviceId, null);
    await this.servicesService.updateStatus(serviceId, ServiceStatus.STOPPED);

    return { stopped: true };
  }

  @Post(':id/exec')
  @ApiOperation({ summary: 'Run a shell command in a deployment container' })
  async exec(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { command?: string },
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    const deployment = await this.deploymentsService.findById(id);

    if (deployment.serviceId !== serviceId) throw new BadRequestException('Deployment does not belong to service');
    if (!deployment.containerId) throw new BadRequestException('No container available for this deployment');
    if (!body.command?.trim()) throw new BadRequestException('Command is required');

    return this.dockerService.execInContainer(this.splitContainerIds(deployment.containerId)[0], [
      'sh',
      '-lc',
      body.command.trim(),
    ]);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get container CPU/memory stats' })
  async stats(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    const deployment = await this.deploymentsService.findById(id);

    if (!deployment.containerId) return null;
    const stats = await Promise.all(
      this.splitContainerIds(deployment.containerId).map((containerId) =>
        this.dockerService.getContainerStats(containerId),
      ),
    );

    if (stats.length === 0) return null;

    const memoryUsage = stats.reduce((sum, item) => sum + item.memoryUsage, 0);
    const memoryLimit = stats.reduce((sum, item) => sum + item.memoryLimit, 0);
    const cpuPercent = stats.reduce((sum, item) => sum + item.cpuPercent, 0);

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsage,
      memoryLimit,
      memoryPercent: memoryLimit > 0 ? Math.round((memoryUsage / memoryLimit) * 10000) / 100 : 0,
      replicas: stats.length,
    };
  }

  @Get(':id/traffic')
  @ApiOperation({ summary: 'Get Traefik request metrics for a deployment service' })
  async traffic(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const service = await this.servicesService.findOne(serviceId, user.id);
    const deployment = await this.deploymentsService.findById(id);

    if (deployment.serviceId !== serviceId) throw new BadRequestException('Deployment does not belong to service');

    const routeName = `paas-${serviceId.replace(/[^a-zA-Z0-9-]/g, '-')}@file`;
    const metricsUrl = process.env.TRAEFIK_METRICS_URL ?? 'http://traefik:8082/metrics';
    const activeContainerNames = this.splitContainerIds(deployment.containerName ?? '');
    let replicaTraffic: ReplicaTraffic[] = [];

    try {
      const logs = await this.dockerService.getContainerLogs('paas-traefik', 3000);
      replicaTraffic = this.parseTraefikReplicaTraffic(logs, routeName, activeContainerNames);
    } catch {
      replicaTraffic = [];
    }

    try {
      const { data } = await axios.get<string>(metricsUrl, { timeout: 2000 });
      return {
        ...this.parseTraefikTraffic(data, routeName),
        lbMaxInFlight: service.lbMaxInFlight ?? 1000,
        sampleSize: replicaTraffic.reduce((sum, item) => sum + item.requests, 0),
        replicaRequests: replicaTraffic,
      };
    } catch {
      return {
        requestsTotal: 0,
        requestsByCode: {},
        service: routeName,
        available: false,
        lbMaxInFlight: service.lbMaxInFlight ?? 1000,
        sampleSize: replicaTraffic.reduce((sum, item) => sum + item.requests, 0),
        replicaRequests: replicaTraffic,
      };
    }
  }

  private splitContainerIds(containerIds: string): string[] {
    return containerIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  private parseTraefikTraffic(metrics: string, serviceName: string): {
    requestsTotal: number;
    requestsByCode: Record<string, number>;
    service: string;
    available: boolean;
  } {
    const requestsByCode: Record<string, number> = {};
    let requestsTotal = 0;

    for (const line of metrics.split('\n')) {
      if (!line.startsWith('traefik_service_requests_total{')) continue;
      if (!line.includes(`service="${serviceName}"`)) continue;

      const value = Number(line.trim().split(/\s+/).at(-1));
      if (!Number.isFinite(value)) continue;

      const code = line.match(/code="([^"]+)"/)?.[1] ?? 'unknown';
      requestsByCode[code] = (requestsByCode[code] ?? 0) + value;
      requestsTotal += value;
    }

    return {
      requestsTotal,
      requestsByCode,
      service: serviceName,
      available: true,
    };
  }

  private parseTraefikReplicaTraffic(
    logs: string,
    serviceName: string,
    activeContainerNames: string[],
  ): ReplicaTraffic[] {
    const byTarget = new Map<string, ReplicaTraffic>();
    const activeTargets = new Set(activeContainerNames);
    const windowMs = Number(process.env.TRAEFIK_TRAFFIC_WINDOW_MS ?? 10_000);
    const since = Date.now() - windowMs;
    let total = 0;

    for (const rawLine of logs.split('\n')) {
      const jsonStart = rawLine.indexOf('{');
      if (jsonStart < 0) continue;

      let entry: Record<string, any>;
      try {
        entry = JSON.parse(rawLine.slice(jsonStart));
      } catch {
        continue;
      }

      const entryService = String(entry.ServiceName ?? '');
      const router = String(entry.RouterName ?? '');
      if (entryService !== serviceName && router !== serviceName) continue;

      const target = String(entry.ServiceAddr ?? entry.ServiceURL ?? 'unknown');
      const targetContainer = target.replace(/^https?:\/\//, '').split(':')[0];
      if (target !== 'unknown' && activeTargets.size > 0 && !activeTargets.has(targetContainer)) continue;

      const startedAt = typeof entry.StartUTC === 'string' ? Date.parse(entry.StartUTC) : Number.NaN;
      if (Number.isFinite(startedAt) && startedAt < since) continue;

      const status = String(entry.DownstreamStatus ?? entry.OriginStatus ?? 'unknown');
      const current = byTarget.get(target) ?? {
        target,
        requests: 0,
        percent: 0,
        statusCodes: {},
      };

      current.requests += 1;
      current.statusCodes[status] = (current.statusCodes[status] ?? 0) + 1;
      current.lastPath = typeof entry.RequestPath === 'string' ? entry.RequestPath : current.lastPath;
      current.lastSeen = typeof entry.StartUTC === 'string' ? entry.StartUTC : current.lastSeen;
      byTarget.set(target, current);
      total += 1;
    }

    return [...byTarget.values()]
      .map((item) => ({
        ...item,
        percent: total > 0 ? Math.round((item.requests / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.requests - a.requests);
  }
}

interface ReplicaTraffic {
  target: string;
  requests: number;
  percent: number;
  statusCodes: Record<string, number>;
  lastPath?: string;
  lastSeen?: string;
}
