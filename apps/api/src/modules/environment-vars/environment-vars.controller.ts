import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EnvironmentVarsService } from './environment-vars.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ServicesService } from '../services/services.service';

class EnvVarItemDto {
  @IsString() key: string;
  @IsString() value: string;
  @IsBoolean() @IsOptional() isSecret?: boolean;
}

class UpsertEnvVarsBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvVarItemDto)
  vars: EnvVarItemDto[];
}

@ApiTags('environment-vars')
@ApiBearerAuth()
@Controller('services/:serviceId/env')
export class EnvironmentVarsController {
  constructor(
    private readonly envVarsService: EnvironmentVarsService,
    private readonly servicesService: ServicesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List env var keys (values never returned)' })
  async findAll(@CurrentUser() user: User, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.envVarsService.findAll(serviceId);
  }

  @Put()
  @ApiOperation({ summary: 'Bulk upsert environment variables' })
  async upsert(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpsertEnvVarsBodyDto,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.envVarsService.upsert(serviceId, dto);
  }

  @Delete(':key')
  async remove(
    @CurrentUser() user: User,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('key') key: string,
  ) {
    await this.servicesService.findOne(serviceId, user.id);
    return this.envVarsService.remove(serviceId, key);
  }
}
