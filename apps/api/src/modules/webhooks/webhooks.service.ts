import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Service } from '../services/entities/service.entity';
import { BuildsService } from '../builds/builds.service';
import { DeploymentsService } from '../deployments/deployments.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Service) private readonly servicesRepo: Repository<Service>,
    private readonly buildsService: BuildsService,
    private readonly deploymentsService: DeploymentsService,
    private readonly config: ConfigService,
  ) {}

  verifyGithubSignature(payload: string, signature: string): boolean {
    const secret = this.config.getOrThrow<string>('GITHUB_WEBHOOK_SECRET');
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async handlePush(serviceId: string, payload: any): Promise<{ buildId: string }> {
    const service = await this.servicesRepo.findOne({
      where: { id: serviceId },
    });

    if (!service) throw new NotFoundException('Service not found');

    const pushedBranch = payload.ref?.replace('refs/heads/', '');

    // Only build if the push is to the tracked branch
    if (pushedBranch && pushedBranch !== service.gitBranch) {
      this.logger.log(`Ignoring push to branch ${pushedBranch} (tracking ${service.gitBranch})`);
      return { buildId: 'ignored' };
    }

    const headCommit = payload.head_commit ?? payload.commits?.[0];

    const build = await this.buildsService.trigger({
      serviceId,
      commitSha: headCommit?.id ?? payload.after,
      commitMessage: headCommit?.message,
      commitAuthor: headCommit?.author?.name,
      branch: pushedBranch,
    });

    this.logger.log(`Build ${build.id} triggered for service ${serviceId} commit ${build.commitSha}`);
    return { buildId: build.id };
  }
}
