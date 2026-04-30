import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { BuildStatus, DeploymentStatus, WsEvent } from '@paas/shared';

@Injectable()
export class LogsService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitBuildLog(buildId: string, serviceId: string, line: string) {
    this.server?.to(`build:${buildId}`).emit(WsEvent.BUILD_LOG, {
      buildId,
      serviceId,
      line,
      timestamp: new Date().toISOString(),
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
    this.server?.to(`deploy:${deploymentId}`).emit(WsEvent.DEPLOY_LOG, {
      deploymentId,
      serviceId,
      line,
      timestamp: new Date().toISOString(),
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
}
