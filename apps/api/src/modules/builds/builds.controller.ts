import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BuildsService } from './builds.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServicesService } from '../services/services.service';
import { User } from '../users/entities/user.entity';

@ApiTags('builds')
@ApiBearerAuth()
@Controller('services/:serviceId/builds')
export class BuildsController {
  constructor(
    private readonly buildsService: BuildsService,
    private readonly servicesService: ServicesService,
    private readonly storageService: StorageService,
  ) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Manually trigger a build for the latest commit' })
  async trigger(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    const service = await this.servicesService.findOne(serviceId, user.id);
    return this.buildsService.trigger({
      serviceId,
      commitSha: 'HEAD',
      branch: service.gitBranch,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List recent builds for a service' })
  async findAll(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.buildsService.findByService(serviceId);
  }

  @Get(':buildId')
  async findOne(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('buildId', ParseUUIDPipe) buildId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.buildsService.findById(buildId);
  }

  @Get(':buildId/logs/download')
  @ApiOperation({ summary: 'Get pre-signed URL to download build logs' })
  async downloadLogs(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('buildId', ParseUUIDPipe) buildId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    const build = await this.buildsService.findById(buildId);
    if (!build.logPath) return { url: null };
    const url = await this.storageService.getPresignedUrl(build.logPath);
    return { url };
  }
}
