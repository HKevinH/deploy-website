import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LogsService } from './logs.service';
import { DockerService } from '../../infrastructure/docker/docker.service';
import { DeploymentsService } from '../deployments/deployments.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/logs',
})
export class LogsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(LogsGateway.name);
  private readonly logStreamCleanup = new Map<string, () => void>();

  constructor(
    private readonly logsService: LogsService,
    private readonly dockerService: DockerService,
    private readonly deploymentsService: DeploymentsService,
  ) {}

  afterInit(server: Server) {
    this.logsService.setServer(server);
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    // Clean up any log streams for this socket
    const cleanup = this.logStreamCleanup.get(client.id);
    if (cleanup) {
      cleanup();
      this.logStreamCleanup.delete(client.id);
    }
  }

  @SubscribeMessage('subscribe:build')
  async subscribeBuild(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { buildId: string },
  ) {
    await client.join(`build:${data.buildId}`);
    for (const log of this.logsService.getBuildLogs(data.buildId)) {
      client.emit('build:log', { buildId: data.buildId, ...log });
    }
    client.emit('subscribed', { room: `build:${data.buildId}` });
  }

  @SubscribeMessage('subscribe:deploy')
  async subscribeDeploy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string },
  ) {
    await client.join(`deploy:${data.deploymentId}`);
    for (const log of this.logsService.getDeployLogs(data.deploymentId)) {
      client.emit('deploy:log', { deploymentId: data.deploymentId, ...log });
    }
    client.emit('subscribed', { room: `deploy:${data.deploymentId}` });
  }

  @SubscribeMessage('subscribe:service')
  async subscribeService(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serviceId: string },
  ) {
    await client.join(`service:${data.serviceId}`);
    client.emit('subscribed', { room: `service:${data.serviceId}` });
  }

  @SubscribeMessage('stream:container-logs')
  async streamContainerLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string; tail?: number },
  ) {
    try {
      const deployment = await this.deploymentsService.findById(data.deploymentId);
      if (!deployment.containerId) {
        client.emit('error', { message: 'No active container for this deployment' });
        return;
      }

      // Clean up any existing stream for this client
      const existing = this.logStreamCleanup.get(client.id);
      if (existing) existing();

      const cancel = await this.dockerService.streamContainerLogs(
        deployment.containerId,
        (line, stream) => {
          client.emit('container:log', { line, stream, timestamp: new Date().toISOString() });
        },
        { tail: data.tail ?? 100, follow: true },
      );

      this.logStreamCleanup.set(client.id, cancel);
    } catch (err) {
      client.emit('error', { message: 'Failed to stream logs' });
    }
  }

  @SubscribeMessage('stop:container-logs')
  stopContainerLogs(@ConnectedSocket() client: Socket) {
    const cancel = this.logStreamCleanup.get(client.id);
    if (cancel) {
      cancel();
      this.logStreamCleanup.delete(client.id);
    }
  }
}
