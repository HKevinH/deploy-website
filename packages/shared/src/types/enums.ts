export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum ServiceStatus {
  IDLE = 'idle',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  RUNNING = 'running',
  STOPPED = 'stopped',
  FAILED = 'failed',
  DEGRADED = 'degraded',
}

export enum BuildStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum DeploymentStatus {
  PENDING = 'pending',
  DEPLOYING = 'deploying',
  ACTIVE = 'active',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  STOPPED = 'stopped',
}

export enum DomainStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  FAILED = 'failed',
  SSL_PENDING = 'ssl_pending',
  SSL_ACTIVE = 'ssl_active',
}

export enum GitProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
}

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}
