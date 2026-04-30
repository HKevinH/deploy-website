import { Module, forwardRef } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsGateway } from './logs.gateway';
import { DeploymentsModule } from '../deployments/deployments.module';

@Module({
  imports: [forwardRef(() => DeploymentsModule)],
  providers: [LogsService, LogsGateway],
  exports: [LogsService],
})
export class LogsModule {}
