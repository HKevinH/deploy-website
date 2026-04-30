import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as tar from 'tar-fs';
import { BuildsService } from './builds.service';
import { DockerService } from '../../infrastructure/docker/docker.service';
import { GitProviderService } from '../../infrastructure/git/git-provider.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { LogsService } from '../logs/logs.service';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { BuildStatus, ServiceStatus, WsEvent } from '@paas/shared';
import { QUEUE_BUILDS } from '../../infrastructure/queue/queue.module';
import { ConfigService } from '@nestjs/config';

interface BuildJobPayload {
  buildId: string;
  serviceId: string;
}

@Processor(QUEUE_BUILDS)
export class BuildsProcessor {
  private readonly logger = new Logger(BuildsProcessor.name);

  constructor(
    private readonly buildsService: BuildsService,
    private readonly dockerService: DockerService,
    private readonly gitService: GitProviderService,
    private readonly storageService: StorageService,
    private readonly logsService: LogsService,
    private readonly servicesService: ServicesService,
    private readonly usersService: UsersService,
    private readonly deploymentsService: DeploymentsService,
    private readonly config: ConfigService,
  ) {}

  @Process('build')
  async handleBuild(job: Job<BuildJobPayload>): Promise<void> {
    const { buildId, serviceId } = job.data;
    const startTime = Date.now();
    const logLines: string[] = [];

    await this.buildsService.updateStatus(buildId, BuildStatus.BUILDING);
    await this.servicesService.updateStatus(serviceId, ServiceStatus.BUILDING);

    const build = await this.buildsService.findById(buildId);
    const service = build.service;

    const log = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      logLines.push(`[${new Date().toISOString()}] ${trimmed}`);
      this.logsService.emitBuildLog(buildId, serviceId, trimmed);
    };

    let tempDir: string | null = null;

    try {
      // ── 1. Clone repository ──────────────────────────────────────────────
      log(`▶ Cloning ${service.gitUrl} @ ${service.gitBranch}`);

      const accessToken = await this.usersService
        .getDecryptedGithubToken(service.project.ownerId)
        .catch(() => null);

      tempDir = await this.gitService.clone({
        url: service.gitUrl!,
        branch: service.gitBranch,
        commitSha: build.commitSha,
        accessToken: accessToken ?? undefined,
      });

      log(`✓ Repository cloned`);
      await job.progress(10);

      // ── 2. Prepare build context ─────────────────────────────────────────
      log(`▶ Packaging build context...`);
      const contextDir = path.join(tempDir, service.dockerContext ?? '.');
      const dockerfilePath = await this.ensureDockerfile(contextDir, service.dockerfilePath ?? 'Dockerfile', log);
      const tarStream = tar.pack(contextDir);
      await job.progress(15);

      // ── 3. Build image ───────────────────────────────────────────────────
      const registryUrl = this.config.getOrThrow<string>('REGISTRY_URL');
      const imageName = `${registryUrl}/${service.project.slug}/${service.name}`;
      const imageTag = build.commitSha.substring(0, 8);

      log(`▶ Building image ${imageName}:${imageTag}`);

      await this.dockerService.buildImage(
        tarStream,
        {
          imageName,
          tag: imageTag,
          dockerfilePath,
          buildArgs: {
            GIT_COMMIT: build.commitSha,
            BUILD_DATE: new Date().toISOString(),
          },
          labels: {
            'paas.build': buildId,
            'paas.service': serviceId,
          },
        },
        log,
      );

      log(`✓ Image built`);
      await job.progress(70);

      // ── 4. Push to registry ──────────────────────────────────────────────
      const registryUser = this.config.get<string>('REGISTRY_USERNAME', '');
      const registryPass = this.config.get<string>('REGISTRY_PASSWORD', '');

      if (registryUser) {
        log(`▶ Pushing ${imageName}:${imageTag} to registry`);
        await this.dockerService.pushImage(imageName, imageTag, {
          username: registryUser,
          password: registryPass,
          serveraddress: registryUrl,
        }, log);
        log(`✓ Image pushed`);
      }

      await job.progress(90);

      // ── 5. Save logs & finalize ──────────────────────────────────────────
      const logPath = await this.storageService.uploadBuildLog(buildId, logLines.join('\n'));
      const duration = Math.round((Date.now() - startTime) / 1000);

      await this.buildsService.markSuccess(buildId, { imageName, imageTag, logPath, durationSeconds: duration });
      await this.servicesService.updateStatus(serviceId, ServiceStatus.IDLE);

      log(`✓ Build completed in ${duration}s`);

      if (service.autoDeploy) {
        const deployment = await this.deploymentsService.triggerDeploy(serviceId, buildId);
        log(`✓ Auto deploy queued as deployment ${deployment.id}`);
      }

      await job.progress(100);

      this.logsService.emitBuildStatus(buildId, serviceId, BuildStatus.SUCCESS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`✗ Build failed: ${msg}`);

      const duration = Math.round((Date.now() - startTime) / 1000);
      const logPath = await this.storageService.uploadBuildLog(buildId, logLines.join('\n'));
      await this.buildsService.markFailed(buildId, msg, duration, logPath);
      await this.servicesService.updateStatus(serviceId, ServiceStatus.FAILED);

      this.logsService.emitBuildStatus(buildId, serviceId, BuildStatus.FAILED);
      this.logger.error(`Build ${buildId} failed: ${msg}`);
      throw err;
    } finally {
      if (tempDir) await this.gitService.cleanup(tempDir);
    }
  }

  private async ensureDockerfile(
    contextDir: string,
    dockerfilePath: string,
    log: (line: string) => void,
  ): Promise<string> {
    try {
      await fs.access(path.join(contextDir, dockerfilePath));
      return dockerfilePath;
    } catch {
      // Generate a Dockerfile for common Node projects when the repo does not include one.
    }

    try {
      const pkg = JSON.parse(await fs.readFile(path.join(contextDir, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const isNext = Boolean(deps.next);
      const isNode = Boolean(pkg.scripts?.start || pkg.scripts?.build);

      if (!isNext && !isNode) throw new Error('Unsupported repository without Dockerfile');

      const generatedPath = '.paas/Dockerfile';
      await fs.mkdir(path.join(contextDir, '.paas'), { recursive: true });
      await fs.writeFile(path.join(contextDir, generatedPath), this.createNodeDockerfile(contextDir, isNext), 'utf8');
      log(`Generated ${isNext ? 'Next.js' : 'Node.js'} Dockerfile at ${generatedPath}`);
      return generatedPath;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Dockerfile not found at ${dockerfilePath}. Automatic Dockerfile generation failed: ${message}`);
    }
  }

  private createNodeDockerfile(contextDir: string, isNext: boolean): string {
    const packageManager = this.detectPackageManager(contextDir);
    const install = {
      npm: 'npm install',
      pnpm: 'npm install -g pnpm && pnpm install --frozen-lockfile',
      yarn: 'corepack enable && yarn install --frozen-lockfile',
    }[packageManager];
    const build = {
      npm: 'npm run build',
      pnpm: 'pnpm build',
      yarn: 'yarn build',
    }[packageManager];
    const start = {
      npm: 'npm run start',
      pnpm: 'pnpm start',
      yarn: 'yarn start',
    }[packageManager];

    return `FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN ${install}

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ${isNext ? build : `${build} || true`}

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "${start}"]
`;
  }

  private detectPackageManager(contextDir: string): 'npm' | 'pnpm' | 'yarn' {
    if (fsSync.existsSync(path.join(contextDir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fsSync.existsSync(path.join(contextDir, 'yarn.lock'))) return 'yarn';
    return 'npm';
  }
}
