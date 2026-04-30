import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { DomainsService } from './domains.service';
import { ServicesService } from '../services/services.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class AddDomainDto {
  @IsString() hostname: string;
}

@ApiTags('domains')
@ApiBearerAuth()
@Controller('services/:serviceId/domains')
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly servicesService: ServicesService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.domainsService.findByService(serviceId);
  }

  @Post()
  async addCustomDomain(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: AddDomainDto,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.domainsService.addCustomDomain(serviceId, dto.hostname);
  }

  @Delete(':domainId')
  async remove(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.domainsService.remove(serviceId, domainId);
  }
}
