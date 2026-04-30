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
import { DeploymentsService } from './deployments.service';
import { ServicesService } from '../services/services.service';
import { DockerService } from '../../infrastructure/docker/docker.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

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
      await this.dockerService.restartContainer(deployment.containerId);
    }

    return { restarted: true };
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

    return this.dockerService.execInContainer(deployment.containerId, [
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
    return this.dockerService.getContainerStats(deployment.containerId);
  }
}
