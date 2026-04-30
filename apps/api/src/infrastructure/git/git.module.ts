import { Global, Module } from '@nestjs/common';
import { GitProviderService } from './git-provider.service';

@Global()
@Module({
  providers: [GitProviderService],
  exports: [GitProviderService],
})
export class GitModule {}
