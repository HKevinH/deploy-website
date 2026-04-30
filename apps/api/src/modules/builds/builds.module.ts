import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { BuildsService } from './builds.service';
import { BuildsController } from './builds.controller';
import { BuildsProcessor } from './builds.processor';
import { Build } from './entities/build.entity';
import { ServicesModule } from '../services/services.module';
import { LogsModule } from '../logs/logs.module';
import { UsersModule } from '../users/users.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { QUEUE_BUILDS } from '../../infrastructure/queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Build]),
    BullModule.registerQueue({ name: QUEUE_BUILDS }),
    ServicesModule,
    LogsModule,
    UsersModule,
    DeploymentsModule,
  ],
  providers: [BuildsService, BuildsProcessor, StorageService],
  controllers: [BuildsController],
  exports: [BuildsService],
})
export class BuildsModule {}
