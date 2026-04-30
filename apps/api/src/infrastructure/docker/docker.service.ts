import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Docker from 'dockerode';
import { Writable } from 'stream';
import {
  BuildImageOptions,
  ContainerInfo,
  ContainerStats,
  CreateContainerOptions,
  DockerHostInfo,
  ExecResult,
  RegistryAuth,
} from './docker.types';

@Injectable()
export class DockerService implements OnModuleInit {
  private readonly logger = new Logger(DockerService.name);
  private docker: Docker;

  onModuleInit() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    this.logger.log('Docker client initialized via unix socket');
  }

  // ─── Image Operations ───────────────────────────────────────────────────────

  async buildImage(
    tarStream: NodeJS.ReadableStream,
    options: BuildImageOptions,
    onLog: (line: string) => void,
  ): Promise<void> {
    const buildStream = await this.docker.buildImage(tarStream as any, {
      t: `${options.imageName}:${options.tag}`,
      buildargs: options.buildArgs ?? {},
      labels: options.labels ?? {},
      dockerfile: options.dockerfilePath ?? 'Dockerfile',
      rm: true,
      forcerm: true,
    });

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        buildStream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        },
        (event: { stream?: string; error?: string; status?: string }) => {
          if (event.stream) onLog(event.stream.trim());
          if (event.error) {
            onLog(`ERROR: ${event.error}`);
            reject(new Error(event.error));
          }
        },
      );
    });
  }

  async pushImage(
    imageName: string,
    tag: string,
    auth: RegistryAuth,
    onLog: (line: string) => void,
  ): Promise<void> {
    const image = this.docker.getImage(`${imageName}:${tag}`);
    const pushStream = await image.push({ authconfig: auth });

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(
        pushStream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        },
        (event: { status?: string; error?: string; progressDetail?: unknown }) => {
          if (event.status) onLog(event.status);
          if (event.error) reject(new Error(event.error));
        },
      );
    });
  }

  async pullImage(imageName: string, tag: string, auth?: RegistryAuth): Promise<void> {
    const pullStream = await this.docker.pull(`${imageName}:${tag}`, {
      authconfig: auth,
    });

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(pullStream, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async removeImage(imageName: string, tag: string): Promise<void> {
    try {
      const image = this.docker.getImage(`${imageName}:${tag}`);
      await image.remove({ force: true });
    } catch (err: any) {
      if (err?.statusCode !== 404) throw err;
    }
  }

  // ─── Container Operations ────────────────────────────────────────────────────

  async createAndStartContainer(options: CreateContainerOptions): Promise<string> {
    const envArray = Object.entries(options.env).map(([k, v]) => `${k}=${v}`);
    const networkName = options.networkName ?? 'paas-network';

    const container = await this.docker.createContainer({
      name: options.containerName,
      Image: `${options.imageName}:${options.tag}`,
      Env: envArray,
      Labels: {
        ...this.buildTraefikLabels(options),
        ...options.labels,
        'paas.managed': 'true',
      },
      ExposedPorts: { [`${options.port}/tcp`]: {} },
      HostConfig: {
        NetworkMode: networkName,
        RestartPolicy: { Name: 'unless-stopped' },
        Memory: options.memoryLimit ?? 512 * 1024 * 1024,
        NanoCpus: options.cpuLimit ?? Math.round(0.5 * 1e9),
        LogConfig: {
          Type: 'json-file',
          Config: { 'max-size': '10m', 'max-file': '3' },
        },
      },
      ...(options.healthCheck && {
        Healthcheck: {
          Test: [
            'CMD-SHELL',
            `curl -sf http://localhost:${options.port}${options.healthCheck.path} || exit 1`,
          ],
          Interval: (options.healthCheck.interval ?? 30) * 1_000_000_000,
          Timeout: (options.healthCheck.timeout ?? 5) * 1_000_000_000,
          Retries: options.healthCheck.retries ?? 3,
          StartPeriod: 15 * 1_000_000_000,
        },
      }),
    });

    await container.start();
    this.logger.log(`Container started: ${options.containerName} (${container.id.slice(0, 12)})`);
    return container.id;
  }

  async stopContainer(containerId: string, timeout = 30): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop({ t: timeout });
  }

  async removeContainer(containerId: string, force = false): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force, v: false });
    } catch (err: any) {
      if (err?.statusCode !== 404) throw err;
    }
  }

  async restartContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.restart({ t: 10 });
  }

  async execInContainer(containerId: string, command: string[]): Promise<ExecResult> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const stream = await exec.start({ hijack: true, stdin: false }) as NodeJS.ReadableStream;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const stdoutWriter = new Writable({
        write(chunk, _encoding, callback) {
          stdout.push(Buffer.from(chunk));
          callback();
        },
      });
      const stderrWriter = new Writable({
        write(chunk, _encoding, callback) {
          stderr.push(Buffer.from(chunk));
          callback();
        },
      });

      this.docker.modem.demuxStream(stream, stdoutWriter, stderrWriter);
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const info = await exec.inspect();
    return {
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
      exitCode: info.ExitCode ?? null,
    };
  }

  async getContainerStatus(containerId: string): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch (err: any) {
      if (err?.statusCode === 404) return 'removed';
      throw err;
    }
  }

  async getContainerStats(containerId: string): Promise<ContainerStats> {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false }) as any;

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const numCpus = stats.cpu_stats.online_cpus ?? 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    const memUsage = stats.memory_stats.usage - (stats.memory_stats.stats?.cache ?? 0);
    const memLimit = stats.memory_stats.limit;

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsage: memUsage,
      memoryLimit: memLimit,
      memoryPercent: Math.round((memUsage / memLimit) * 100 * 100) / 100,
    };
  }

  async streamContainerLogs(
    containerId: string,
    onLog: (line: string, stream: 'stdout' | 'stderr') => void,
    opts: { tail?: number; follow?: boolean; since?: number } = {},
  ): Promise<() => void> {
    const container = this.docker.getContainer(containerId);
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      tail: opts.tail ?? 100,
      timestamps: true,
      since: opts.since,
    }) as any;

    const stdoutWriter = {
      write: (chunk: Buffer) => onLog(chunk.toString('utf8').trim(), 'stdout'),
    };
    const stderrWriter = {
      write: (chunk: Buffer) => onLog(chunk.toString('utf8').trim(), 'stderr'),
    };

    container.modem.demuxStream(logStream, stdoutWriter, stderrWriter);

    return () => logStream.destroy();
  }

  // ─── Health & Readiness ──────────────────────────────────────────────────────

  async waitForHealthy(containerId: string, timeoutMs = 120_000): Promise<boolean> {
    const container = this.docker.getContainer(containerId);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const info = await container.inspect();
      const health = info.State.Health?.Status;

      if (health === 'healthy') return true;
      if (health === 'unhealthy') return false;
      if (!health) return true; // no healthcheck → assume running is healthy

      await new Promise((r) => setTimeout(r, 2_000));
    }

    return false;
  }

  // ─── Network ─────────────────────────────────────────────────────────────────

  async ensureNetwork(name: string): Promise<void> {
    const nets = await this.docker.listNetworks({ filters: { name: [name] } });
    if (nets.length === 0) {
      await this.docker.createNetwork({
        Name: name,
        Driver: 'bridge',
        Labels: { 'paas.managed': 'true' },
      });
      this.logger.log(`Created network: ${name}`);
    }
  }

  async listManagedContainers(): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: ['paas.managed=true'] },
    });

    return containers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') ?? '',
      status: c.State,
      image: c.Image,
      created: c.Created,
      labels: c.Labels,
    }));
  }

  async listAllContainers(): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({ all: true });

    return containers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') ?? '',
      status: c.State,
      image: c.Image,
      created: c.Created,
      labels: c.Labels,
    }));
  }

  async getHostInfo(): Promise<DockerHostInfo> {
    const info = await this.docker.info();
    return {
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      images: info.Images,
      serverVersion: info.ServerVersion,
      operatingSystem: info.OperatingSystem,
      architecture: info.Architecture,
      cpus: info.NCPU,
      memoryTotal: info.MemTotal,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private buildTraefikLabels(options: CreateContainerOptions): Record<string, string> {
    const svc = options.containerName.replace(/[^a-zA-Z0-9-]/g, '-');
    return {
      'traefik.enable': 'true',
      [`traefik.http.routers.${svc}.rule`]: `Host(\`${options.domain}\`)`,
      [`traefik.http.routers.${svc}.entrypoints`]: 'websecure',
      [`traefik.http.routers.${svc}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.services.${svc}.loadbalancer.server.port`]: String(options.port),
      [`traefik.http.routers.${svc}.middlewares`]: `${svc}-rl`,
      [`traefik.http.middlewares.${svc}-rl.ratelimit.average`]: '100',
      [`traefik.http.middlewares.${svc}-rl.ratelimit.burst`]: '50',
    };
  }
}
