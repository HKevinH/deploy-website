import { BuildStatus, DeploymentStatus, ServiceStatus } from './enums';

export interface WsPayload<T = unknown> {
  event: WsEvent;
  data: T;
  timestamp: string;
}

export enum WsEvent {
  BUILD_LOG = 'build:log',
  BUILD_STATUS = 'build:status',
  DEPLOY_LOG = 'deploy:log',
  DEPLOY_STATUS = 'deploy:status',
  SERVICE_STATUS = 'service:status',
  CONTAINER_LOG = 'container:log',
  CONTAINER_STATS = 'container:stats',
}

export interface BuildLogEvent {
  buildId: string;
  serviceId: string;
  line: string;
}

export interface BuildStatusEvent {
  buildId: string;
  serviceId: string;
  status: BuildStatus;
}

export interface DeployLogEvent {
  deploymentId: string;
  serviceId: string;
  line: string;
}

export interface DeployStatusEvent {
  deploymentId: string;
  serviceId: string;
  status: DeploymentStatus;
}

export interface ServiceStatusEvent {
  serviceId: string;
  status: ServiceStatus;
}

export interface ContainerLogEvent {
  serviceId: string;
  deploymentId: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
}

export interface ContainerStatsEvent {
  serviceId: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
}
