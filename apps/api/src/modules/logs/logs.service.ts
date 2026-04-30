import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { BuildStatus, DeploymentStatus, WsEvent } from '@paas/shared';

@Injectable()
export class LogsService {
  private server: Server | null = null;
  private readonly buildLogBuffer = new Map<string, { line: string; timestamp: string }[]>();
  private readonly deployLogBuffer = new Map<string, { line: string; timestamp: string }[]>();

  setServer(server: Server) {
    this.server = server;
  }

  emitBuildLog(buildId: string, serviceId: string, line: string) {
    const timestamp = new Date().toISOString();
    this.appendLog(this.buildLogBuffer, buildId, { line, timestamp });
    this.server?.to(`build:${buildId}`).emit(WsEvent.BUILD_LOG, {
      buildId,
      serviceId,
      line,
      timestamp,
    });
  }

  emitBuildStatus(buildId: string, serviceId: string, status: BuildStatus) {
    this.server?.to(`build:${buildId}`).emit(WsEvent.BUILD_STATUS, {
      buildId,
      serviceId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  emitDeployLog(deploymentId: string, serviceId: string, line: string) {
    const timestamp = new Date().toISOString();
    this.appendLog(this.deployLogBuffer, deploymentId, { line, timestamp });
    this.server?.to(`deploy:${deploymentId}`).emit(WsEvent.DEPLOY_LOG, {
      deploymentId,
      serviceId,
      line,
      timestamp,
    });
  }

  emitDeployStatus(deploymentId: string, serviceId: string, status: DeploymentStatus) {
    this.server?.to(`deploy:${deploymentId}`).emit(WsEvent.DEPLOY_STATUS, {
      deploymentId,
      serviceId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  emitContainerLog(serviceId: string, line: string, stream: 'stdout' | 'stderr') {
    this.server?.to(`service:${serviceId}`).emit(WsEvent.CONTAINER_LOG, {
      serviceId,
      line,
      stream,
      timestamp: new Date().toISOString(),
    });
  }

  emitServiceStatus(serviceId: string, status: string) {
    this.server?.to(`service:${serviceId}`).emit(WsEvent.SERVICE_STATUS, {
      serviceId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  getBuildLogs(buildId: string) {
    return this.buildLogBuffer.get(buildId) ?? [];
  }

  getDeployLogs(deploymentId: string) {
    return this.deployLogBuffer.get(deploymentId) ?? [];
  }

  private appendLog(
    buffer: Map<string, { line: string; timestamp: string }[]>,
    id: string,
    entry: { line: string; timestamp: string },
  ) {
    const logs = buffer.get(id) ?? [];
    logs.push(entry);
    buffer.set(id, logs.slice(-500));
  }
}
