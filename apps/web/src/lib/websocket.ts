import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@paas/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

interface TimestampedLog {
  line: string;
  timestamp: string;
}

interface ContainerLog {
  line: string;
  stream: string;
  timestamp: string;
}

const buildLogCache = new Map<string, TimestampedLog[]>();
const deployLogCache = new Map<string, TimestampedLog[]>();
const containerLogCache = new Map<string, ContainerLog[]>();

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

  const logHandler = (data: { buildId?: string; line: string; timestamp: string }) => {
    if (data.buildId && data.buildId !== buildId) return;
    if (!appendCachedLog(buildLogCache, buildId, { line: data.line, timestamp: data.timestamp })) return;
    onLog(data.line, data.timestamp);
  };
  const statusHandler = (data: { buildId?: string; status: string }) => {
    if (data.buildId && data.buildId !== buildId) return;
    onStatus(data.status);
  };
  const resubscribe = () => s.emit('subscribe:build', { buildId });

  s.on(WsEvent.BUILD_LOG, logHandler);
  s.on(WsEvent.BUILD_STATUS, statusHandler);
  s.on('connect', resubscribe);

  for (const log of buildLogCache.get(buildId) ?? []) onLog(log.line, log.timestamp);
  resubscribe();

  return () => {
    s.off(WsEvent.BUILD_LOG, logHandler);
    s.off(WsEvent.BUILD_STATUS, statusHandler);
    s.off('connect', resubscribe);
  };
}

export function subscribeToDeployLogs(
  deploymentId: string,
  onLog: (line: string, timestamp: string) => void,
  onStatus: (status: string) => void,
) {
  const s = getSocket();

  const logHandler = (data: { deploymentId?: string; line: string; timestamp: string }) => {
    if (data.deploymentId && data.deploymentId !== deploymentId) return;
    if (!appendCachedLog(deployLogCache, deploymentId, { line: data.line, timestamp: data.timestamp })) return;
    onLog(data.line, data.timestamp);
  };
  const statusHandler = (data: { deploymentId?: string; status: string }) => {
    if (data.deploymentId && data.deploymentId !== deploymentId) return;
    onStatus(data.status);
  };
  const resubscribe = () => s.emit('subscribe:deploy', { deploymentId });

  s.on(WsEvent.DEPLOY_LOG, logHandler);
  s.on(WsEvent.DEPLOY_STATUS, statusHandler);
  s.on('connect', resubscribe);

  for (const log of deployLogCache.get(deploymentId) ?? []) onLog(log.line, log.timestamp);
  resubscribe();

  return () => {
    s.off(WsEvent.DEPLOY_LOG, logHandler);
    s.off(WsEvent.DEPLOY_STATUS, statusHandler);
    s.off('connect', resubscribe);
  };
}

export function streamContainerLogs(
  deploymentId: string,
  onLog: (line: string, stream: string) => void,
  tail = 100,
) {
  const s = getSocket();

  const handler = (data: { deploymentId?: string; line: string; stream: string; timestamp?: string }) => {
    if (data.deploymentId && data.deploymentId !== deploymentId) return;
    appendCachedLog(containerLogCache, deploymentId, {
      line: data.line,
      stream: data.stream,
      timestamp: data.timestamp ?? new Date().toISOString(),
    });
    onLog(data.line, data.stream);
  };
  const startStream = () => s.emit('stream:container-logs', { deploymentId, tail });

  s.on('container:log', handler);
  s.on('connect', startStream);

  for (const log of containerLogCache.get(deploymentId) ?? []) onLog(log.line, log.stream);
  startStream();

  return () => {
    s.off('container:log', handler);
    s.off('connect', startStream);
    s.emit('stop:container-logs');
  };
}

function appendCachedLog<T extends { line: string; timestamp?: string }>(cache: Map<string, T[]>, key: string, entry: T) {
  const current = cache.get(key) ?? [];
  const exists = current.some((cached) => cached.line === entry.line && cached.timestamp === entry.timestamp);
  if (exists) return false;

  const next = [...current, entry].slice(-800);
  cache.set(key, next);
  return true;
}
