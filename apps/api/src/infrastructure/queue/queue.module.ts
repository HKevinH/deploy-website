import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const QUEUE_BUILDS = 'builds';
export const QUEUE_DEPLOYMENTS = 'deployments';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.getOrThrow('REDIS_URL'));
        return {
          redis: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port) || 6379,
            password: redisUrl.password || undefined,
          },
          defaultJobOptions: {
            removeOnComplete: 50,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUE_BUILDS }),
    BullModule.registerQueue({ name: QUEUE_DEPLOYMENTS }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
