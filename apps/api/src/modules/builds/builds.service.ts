import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Build } from './entities/build.entity';
import { BuildStatus } from '@paas/shared';
import { QUEUE_BUILDS } from '../../infrastructure/queue/queue.module';

export interface TriggerBuildOptions {
  serviceId: string;
  commitSha: string;
  commitMessage?: string;
  commitAuthor?: string;
  branch?: string;
}

@Injectable()
export class BuildsService {
  constructor(
    @InjectRepository(Build) private readonly repo: Repository<Build>,
    @InjectQueue(QUEUE_BUILDS) private readonly queue: Queue,
  ) {}

  async trigger(opts: TriggerBuildOptions): Promise<Build> {
    const build = this.repo.create({
      serviceId: opts.serviceId,
      commitSha: opts.commitSha,
      commitMessage: opts.commitMessage ?? null,
      commitAuthor: opts.commitAuthor ?? null,
      branch: opts.branch ?? null,
      status: BuildStatus.PENDING,
    });

    await this.repo.save(build);

    await this.queue.add('build', { buildId: build.id, serviceId: opts.serviceId }, {
      jobId: build.id,
      priority: 1,
    });

    return build;
  }

  async findById(id: string): Promise<Build> {
    const build = await this.repo.findOne({
      where: { id },
      relations: ['service', 'service.project'],
    });
    if (!build) throw new NotFoundException('Build not found');
    return build;
  }

  async findByService(serviceId: string, limit = 20): Promise<Build[]> {
    return this.repo.find({
      where: { serviceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async updateStatus(id: string, status: BuildStatus): Promise<void> {
    await this.repo.update(id, { status });
  }

  async markSuccess(
    id: string,
    data: { imageName: string; imageTag: string; logPath: string; durationSeconds: number },
  ): Promise<void> {
    await this.repo.update(id, {
      status: BuildStatus.SUCCESS,
      imageName: data.imageName,
      imageTag: data.imageTag,
      logPath: data.logPath,
      durationSeconds: data.durationSeconds,
    });
  }

  async markFailed(
    id: string,
    errorMessage: string,
    durationSeconds?: number,
    logPath?: string,
  ): Promise<void> {
    await this.repo.update(id, {
      status: BuildStatus.FAILED,
      errorMessage,
      durationSeconds: durationSeconds ?? null,
      logPath: logPath ?? null,
    });
  }

  async cancel(id: string): Promise<void> {
    const job = await this.queue.getJob(id);
    if (job) await job.remove();
    await this.repo.update(id, { status: BuildStatus.CANCELLED });
  }
}
