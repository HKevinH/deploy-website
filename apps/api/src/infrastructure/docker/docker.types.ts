export interface BuildImageOptions {
  imageName: string;
  tag: string;
  dockerfilePath?: string;
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface RegistryAuth {
  username: string;
  password: string;
  serveraddress: string;
}

export interface HealthCheckConfig {
  path: string;
  interval?: number;  // seconds
  timeout?: number;   // seconds
  retries?: number;
}

export interface CreateContainerOptions {
  containerName: string;
  imageName: string;
  tag: string;
  env: Record<string, string>;
  port: number;
  domain: string;
  healthCheck?: HealthCheckConfig;
  labels?: Record<string, string>;
  memoryLimit?: number;  // bytes
  cpuLimit?: number;     // NanoCPUs (1 CPU = 1e9)
  networkName?: string;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  created: number;
  labels: Record<string, string>;
}

export interface DockerHostInfo {
  containers: number;
  containersRunning: number;
  images: number;
  serverVersion: string;
  operatingSystem: string;
  architecture: string;
  cpus: number;
  memoryTotal: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
