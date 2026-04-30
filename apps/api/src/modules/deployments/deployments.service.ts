import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Deployment } from './entities/deployment.entity';
import { Build } from '../builds/entities/build.entity';
import { BuildStatus, DeploymentStatus } from '@paas/shared';
import { QUEUE_DEPLOYMENTS } from '../../infrastructure/queue/queue.module';

@Injectable()
export class DeploymentsService {
  constructor(
    @InjectRepository(Deployment) private readonly repo: Repository<Deployment>,
    @InjectRepository(Build) private readonly buildsRepo: Repository<Build>,
    @InjectQueue(QUEUE_DEPLOYMENTS) private readonly queue: Queue,
  ) {}

  async triggerDeploy(serviceId: string, buildId: string, deployedBy?: string): Promise<Deployment> {
    const lastVersion = await this.repo
      .createQueryBuilder('d')
      .select('MAX(d.version)', 'max')
      .where('d.serviceId = :serviceId', { serviceId })
      .getRawOne<{ max: number }>();

    const version = (lastVersion?.max ?? 0) + 1;

    const deployment = this.repo.create({
      serviceId,
      buildId,
      version,
      deployedBy: deployedBy ?? null,
      status: DeploymentStatus.PENDING,
    });

    await this.repo.save(deployment);

    await this.queue.add('deploy', { deploymentId: deployment.id }, {
      jobId: deployment.id,
      priority: 1,
    });

    return deployment;
  }

  async triggerLatestSuccessfulDeploy(serviceId: string, deployedBy?: string): Promise<Deployment> {
    const build = await this.buildsRepo.findOne({
      where: { serviceId, status: BuildStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });

    if (!build?.imageName || !build.imageTag) {
      throw new NotFoundException('No successful build image available to start');
    }

    return this.triggerDeploy(serviceId, build.id, deployedBy);
  }

  async findById(id: string): Promise<Deployment> {
    const deployment = await this.repo.findOne({
      where: { id },
      relations: ['service', 'service.project', 'build'],
    });
    if (!deployment) throw new NotFoundException('Deployment not found');
    return deployment;
  }

  async findByService(serviceId: string, limit = 20): Promise<Deployment[]> {
    return this.repo.find({
      where: { serviceId },
      relations: ['build'],
      order: { version: 'DESC' },
      take: limit,
    });
  }

  async getActiveDeployment(serviceId: string): Promise<Deployment | null> {
    return this.repo.findOne({
      where: { serviceId, status: DeploymentStatus.ACTIVE },
      order: { version: 'DESC' },
    });
  }

  async updateStatus(id: string, status: DeploymentStatus): Promise<void> {
    await this.repo.update(id, { status });
  }

  async updateContainerInfo(id: string, containerId: string, containerName: string): Promise<void> {
    await this.repo.update(id, {
      containerId,
      containerName,
    });
  }

  async markSuccess(id: string, containerId: string, containerName: string, durationSeconds: number): Promise<void> {
    await this.repo.update(id, {
      status: DeploymentStatus.ACTIVE,
      containerId,
      containerName,
      durationSeconds,
    });
  }

  async markFailed(id: string, errorMessage: string, durationSeconds?: number): Promise<void> {
    await this.repo.update(id, {
      status: DeploymentStatus.FAILED,
      errorMessage,
      durationSeconds: durationSeconds ?? null,
    });
  }

  async rollback(serviceId: string, ownerId: string): Promise<Deployment> {
    const deployments = await this.repo.find({
      where: { serviceId },
      order: { version: 'DESC' },
      take: 5,
    });

    const previousSuccessful = deployments.find(
      (d) => d.status === DeploymentStatus.ACTIVE || d.status === DeploymentStatus.STOPPED,
    );

    if (!previousSuccessful) {
      throw new NotFoundException('No previous successful deployment to roll back to');
    }

    return this.triggerDeploy(serviceId, previousSuccessful.buildId, ownerId);
  }
}
