import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { DeploymentsService } from './deployments.service';
import { DockerService } from '../../infrastructure/docker/docker.service';
import { LogsService } from '../logs/logs.service';
import { ServicesService } from '../services/services.service';
import { EnvironmentVarsService } from '../environment-vars/environment-vars.service';
import { DomainsService } from '../domains/domains.service';
import { DeploymentStatus, ServiceStatus } from '@paas/shared';
import { QUEUE_DEPLOYMENTS } from '../../infrastructure/queue/queue.module';

interface DeployJobPayload {
  deploymentId: string;
}

@Processor(QUEUE_DEPLOYMENTS)
export class DeploymentsProcessor {
  private readonly logger = new Logger(DeploymentsProcessor.name);

  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly dockerService: DockerService,
    private readonly logsService: LogsService,
    private readonly servicesService: ServicesService,
    private readonly envVarsService: EnvironmentVarsService,
    private readonly domainsService: DomainsService,
    private readonly config: ConfigService,
  ) {}

  @Process('deploy')
  async handleDeploy(job: Job<DeployJobPayload>): Promise<void> {
    const { deploymentId } = job.data;
    const startTime = Date.now();

    await this.deploymentsService.updateStatus(deploymentId, DeploymentStatus.DEPLOYING);

    const deployment = await this.deploymentsService.findById(deploymentId);
    const { service, build } = deployment;

    const log = (line: string) => {
      this.logsService.emitDeployLog(deploymentId, service.id, line);
    };

    await this.servicesService.updateStatus(service.id, ServiceStatus.DEPLOYING);

    try {
      const registryUser = this.config.get<string>('REGISTRY_USERNAME', '');
      const registryPass = this.config.get<string>('REGISTRY_PASSWORD', '');
      const registryUrl = this.config.getOrThrow<string>('REGISTRY_URL');

      if (registryUser) {
        log(`Pulling image ${build.imageName}:${build.imageTag}`);
        await this.dockerService.pullImage(
          build.imageName!,
          build.imageTag!,
          { username: registryUser, password: registryPass, serveraddress: registryUrl },
        );
        log('Image pulled');
      } else {
        log(`Using local image ${build.imageName}:${build.imageTag}`);
      }

      await job.progress(20);

      const envVars = await this.envVarsService.getDecryptedVars(service.id);
      const domains = await this.domainsService.findByService(service.id);
      const primaryDomain =
        domains.find((d) => !d.isCustom) ??
        domains[0] ??
        await this.domainsService.provisionDefault(
          service.id,
          service.project.slug,
          service.name,
        );

      const containerName = `paas-${service.projectId.slice(0, 8)}-${service.id.slice(0, 8)}-v${deployment.version}`;

      log(`Starting container ${containerName}`);

      const containerId = await this.dockerService.createAndStartContainer({
        containerName,
        imageName: build.imageName!,
        tag: build.imageTag!,
        env: {
          ...envVars,
          PORT: String(service.port ?? 3000),
          NODE_ENV: 'production',
        },
        port: service.port ?? 3000,
        domain: primaryDomain.hostname,
        healthCheck: service.healthCheckPath
          ? { path: service.healthCheckPath, interval: 30, timeout: 5, retries: 3 }
          : undefined,
        memoryLimit: service.memoryLimitMb ? service.memoryLimitMb * 1024 * 1024 : undefined,
        cpuLimit: service.cpuLimit ? Math.round(service.cpuLimit * 1e9) : undefined,
        labels: {
          'paas.project': service.projectId,
          'paas.service': service.id,
          'paas.deployment': deploymentId,
          'paas.version': String(deployment.version),
        },
      });

      log(`Container started (${containerId.slice(0, 12)})`);
      await job.progress(60);

      if (service.healthCheckPath) {
        log(`Waiting for health check at ${service.healthCheckPath}`);
        const healthy = await this.dockerService.waitForHealthy(containerId, 120_000);

        if (!healthy) {
          await this.dockerService.removeContainer(containerId, true);
          throw new Error('Health check failed: container is unhealthy after 120s');
        }

        log('Container is healthy');
      }

      await job.progress(80);

      const previous = await this.deploymentsService.getActiveDeployment(service.id);
      if (previous?.containerId && previous.id !== deploymentId) {
        log(`Stopping previous deployment v${previous.version}`);
        try {
          await this.dockerService.stopContainer(previous.containerId);
          await this.dockerService.removeContainer(previous.containerId);
        } catch (err) {
          this.logger.warn(`Could not remove old container ${previous.containerId}: ${err}`);
        }
        await this.deploymentsService.updateStatus(previous.id, DeploymentStatus.STOPPED);
        log('Previous container stopped');
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      await this.deploymentsService.markSuccess(deploymentId, containerId, containerName, duration);
      await this.servicesService.updateActiveDeployment(service.id, deploymentId);
      await this.servicesService.updateStatus(service.id, ServiceStatus.RUNNING);

      log(`Deployment v${deployment.version} active in ${duration}s`);
      await job.progress(100);

      this.logsService.emitDeployStatus(deploymentId, service.id, DeploymentStatus.ACTIVE);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Deployment failed: ${msg}`);

      const duration = Math.round((Date.now() - startTime) / 1000);
      await this.deploymentsService.markFailed(deploymentId, msg, duration);
      await this.servicesService.updateStatus(service.id, ServiceStatus.FAILED);

      this.logsService.emitDeployStatus(deploymentId, service.id, DeploymentStatus.FAILED);
      this.logger.error(`Deployment ${deploymentId} failed: ${msg}`);
      throw err;
    }
  }
}
