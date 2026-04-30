import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsProcessor } from './deployments.processor';
import { Deployment } from './entities/deployment.entity';
import { Build } from '../builds/entities/build.entity';
import { ServicesModule } from '../services/services.module';
import { EnvironmentVarsModule } from '../environment-vars/environment-vars.module';
import { DomainsModule } from '../domains/domains.module';
import { LogsModule } from '../logs/logs.module';
import { QUEUE_DEPLOYMENTS } from '../../infrastructure/queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deployment, Build]),
    BullModule.registerQueue({ name: QUEUE_DEPLOYMENTS }),
    ServicesModule,
    EnvironmentVarsModule,
    DomainsModule,
    forwardRef(() => LogsModule),
  ],
  providers: [DeploymentsService, DeploymentsProcessor],
  controllers: [DeploymentsController],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
