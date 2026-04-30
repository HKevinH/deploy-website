import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { Service } from '../services/entities/service.entity';
import { BuildsModule } from '../builds/builds.module';
import { DeploymentsModule } from '../deployments/deployments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service]),
    BuildsModule,
    DeploymentsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
