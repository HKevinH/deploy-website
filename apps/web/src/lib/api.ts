import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${BASE_URL}/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('paas_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('paas_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  register: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { email, password }),
  me: () => api.get<User>('/auth/me'),
  gitConnections: () => api.get<GitConnection[]>('/auth/git-connections'),
  startGithubOAuth: () => api.get<{ configured: boolean; authorizationUrl: string | null }>('/auth/git-connections/github/start'),
  completeGithubOAuth: (code: string) =>
    api.post<GitConnection>('/auth/git-connections/github/callback', { code }),
  connectGithub: (token: string) => api.post<GitConnection>('/auth/git-connections/github', { token }),
  disconnectGithub: () => api.delete('/auth/git-connections/github'),
};

// ─── Projects ──────────────────────────────────────────────────────────────

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: CreateProjectInput) => api.post<Project>('/projects', data),
  update: (id: string, data: Partial<CreateProjectInput>) =>
    api.patch<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// ─── Services ──────────────────────────────────────────────────────────────

export const servicesApi = {
  list: (projectId: string) => api.get<Service[]>(`/projects/${projectId}/services`),
  get: (serviceId: string) => api.get<Service>(`/projects/x/services/${serviceId}`),
  create: (projectId: string, data: CreateServiceInput) =>
    api.post<Service>(`/projects/${projectId}/services`, data),
  update: (serviceId: string, data: Partial<CreateServiceInput>) =>
    api.patch<Service>(`/projects/x/services/${serviceId}`, data),
  delete: (serviceId: string) => api.delete(`/projects/x/services/${serviceId}`),
};

// ─── Builds ────────────────────────────────────────────────────────────────

export const buildsApi = {
  list: (serviceId: string) => api.get<Build[]>(`/services/${serviceId}/builds`),
  get: (serviceId: string, buildId: string) =>
    api.get<Build>(`/services/${serviceId}/builds/${buildId}`),
  trigger: (serviceId: string) => api.post<Build>(`/services/${serviceId}/builds/trigger`),
  downloadLogs: (serviceId: string, buildId: string) =>
    api.get<{ url: string }>(`/services/${serviceId}/builds/${buildId}/logs/download`),
};

// ─── Deployments ───────────────────────────────────────────────────────────

export const deploymentsApi = {
  list: (serviceId: string) => api.get<Deployment[]>(`/services/${serviceId}/deployments`),
  get: (serviceId: string, deploymentId: string) =>
    api.get<Deployment>(`/services/${serviceId}/deployments/${deploymentId}`),
  rollback: (serviceId: string) => api.post(`/services/${serviceId}/deployments/rollback`),
  restart: (serviceId: string, deploymentId: string) =>
    api.post(`/services/${serviceId}/deployments/${deploymentId}/restart`),
  exec: (serviceId: string, deploymentId: string, command: string) =>
    api.post<ExecResult>(`/services/${serviceId}/deployments/${deploymentId}/exec`, { command }),
  stats: (serviceId: string, deploymentId: string) =>
    api.get<ContainerStats>(`/services/${serviceId}/deployments/${deploymentId}/stats`),
};

// ─── Environment Variables ─────────────────────────────────────────────────

export const envVarsApi = {
  list: (serviceId: string) => api.get<EnvVarKey[]>(`/services/${serviceId}/env`),
  upsert: (serviceId: string, vars: EnvVarInput[]) =>
    api.put(`/services/${serviceId}/env`, { vars }),
  remove: (serviceId: string, key: string) => api.delete(`/services/${serviceId}/env/${key}`),
};

// ─── Types ─────────────────────────────────────────────────────────────────

export interface User { id: string; email: string; role: string; createdAt: string; }
export interface GitConnection { id: string; provider: 'github'; username: string; avatarUrl: string | null; connected?: boolean; }
export interface Project { id: string; name: string; slug: string; description: string | null; services: Service[]; createdAt: string; }
export interface Service { id: string; name: string; status: string; gitUrl: string | null; gitBranch: string; gitProvider?: string | null; port: number; autoDeploy?: boolean; activeDeploymentId: string | null; activeDeployment: Deployment | null; domains: Domain[]; createdAt: string; }
export interface Build { id: string; status: string; commitSha: string; commitMessage: string | null; commitAuthor: string | null; branch: string | null; imageName: string | null; imageTag: string | null; durationSeconds: number | null; createdAt: string; }
export interface Deployment { id: string; version: number; status: string; containerId: string | null; containerName: string | null; build: Build; durationSeconds: number | null; createdAt: string; }
export interface Domain { id: string; hostname: string; isCustom: boolean; status: string; sslEnabled: boolean; }
export interface EnvVarKey { id: string; key: string; isSecret: boolean; }
export interface ContainerStats { cpuPercent: number; memoryUsage: number; memoryLimit: number; memoryPercent: number; }
export interface ExecResult { stdout: string; stderr: string; exitCode: number | null; }
export interface CreateProjectInput { name: string; slug?: string; description?: string; }
export interface CreateServiceInput { name: string; gitUrl?: string; gitBranch?: string; gitProvider?: string; port?: number; dockerfilePath?: string; autoDeploy?: boolean; }
export interface EnvVarInput { key: string; value: string; isSecret?: boolean; }
