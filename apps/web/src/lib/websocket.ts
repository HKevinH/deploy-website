import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@paas/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const token = localStorage.getItem('paas_token');
    socket = io(`${WS_URL}/logs`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function subscribeToBuildLogs(
  buildId: string,
  onLog: (line: string, timestamp: string) => void,
  onStatus: (status: string) => void,
) {
  const s = getSocket();
  s.emit('subscribe:build', { buildId });

  const logHandler = (data: { line: string; timestamp: string }) => onLog(data.line, data.timestamp);
  const statusHandler = (data: { status: string }) => onStatus(data.status);

  s.on(WsEvent.BUILD_LOG, logHandler);
  s.on(WsEvent.BUILD_STATUS, statusHandler);

  return () => {
    s.off(WsEvent.BUILD_LOG, logHandler);
    s.off(WsEvent.BUILD_STATUS, statusHandler);
  };
}

export function subscribeToDeployLogs(
  deploymentId: string,
  onLog: (line: string, timestamp: string) => void,
  onStatus: (status: string) => void,
) {
  const s = getSocket();
  s.emit('subscribe:deploy', { deploymentId });

  const logHandler = (data: { line: string; timestamp: string }) => onLog(data.line, data.timestamp);
  const statusHandler = (data: { status: string }) => onStatus(data.status);

  s.on(WsEvent.DEPLOY_LOG, logHandler);
  s.on(WsEvent.DEPLOY_STATUS, statusHandler);

  return () => {
    s.off(WsEvent.DEPLOY_LOG, logHandler);
    s.off(WsEvent.DEPLOY_STATUS, statusHandler);
  };
}

export function streamContainerLogs(
  deploymentId: string,
  onLog: (line: string, stream: string) => void,
  tail = 100,
) {
  const s = getSocket();
  s.emit('stream:container-logs', { deploymentId, tail });

  const handler = (data: { line: string; stream: string }) => onLog(data.line, data.stream);
  s.on('container:log', handler);

  return () => {
    s.off('container:log', handler);
    s.emit('stop:container-logs');
  };
}
