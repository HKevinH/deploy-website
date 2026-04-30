# PaaS Platform — Architecture Document

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│   Next.js Dashboard (port 3001)    CLI Tool (optional)              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│                     TRAEFIK (port 80/443)                           │
│   SSL Termination · Rate Limiting · Routing · Let's Encrypt         │
└──────┬──────────────────────────────────────────┬───────────────────┘
       │ /v1/*                                     │ /*.paas.app
┌──────▼──────────────────────────────────────────▼───────────────────┐
│         NESTJS API (port 3000)          USER CONTAINERS              │
│                                         (dynamic, Traefik-routed)   │
│  ┌─ AuthModule (JWT + API Keys)                                      │
│  ├─ ProjectsModule    ┌──────────────────────────────────────────┐  │
│  ├─ ServicesModule    │         INFRASTRUCTURE LAYER             │  │
│  ├─ BuildsModule ─────┤  DockerService → /var/run/docker.sock    │  │
│  ├─ DeploymentsModule─┤  GitProviderService → clone repos        │  │
│  ├─ LogsModule (WS)   │  StorageService → MinIO (build logs)     │  │
│  ├─ WebhooksModule    │  CryptoService → AES-256-GCM (env vars)  │  │
│  └─ DomainsModule     └──────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│   PostgreSQL (entities)   Redis (BullMQ queues + cache)   MinIO     │
└─────────────────────────────────────────────────────────────────────┘
```

## CI/CD Flow

```
Developer pushes to GitHub
         │
         ▼
GitHub Webhook ──► POST /v1/webhooks/github/:serviceId
         │
         ▼
WebhooksService.handlePush()
  · Verifies HMAC-SHA256 signature
  · Checks if push is to tracked branch
         │
         ▼
BuildsService.trigger()
  · Creates Build record (status=PENDING)
  · Enqueues job to Redis via BullMQ
         │
         ▼
BuildsProcessor.handleBuild() ← BullMQ Worker
  1. Clone repo (simple-git) into /tmp/paas-build-xxx
  2. Pack directory into tar stream
  3. docker build (Dockerode → Docker Engine API)
     · Streams build logs via WebSocket (LogsGateway)
  4. docker push → private registry
  5. Upload full log to MinIO (paas-build-logs bucket)
  6. Update Build record (status=SUCCESS, imageName, imageTag)
  7. If autoDeploy=true → trigger deployment
         │
         ▼
DeploymentsService.triggerDeploy()
  · Creates Deployment record (status=PENDING, version++)
  · Enqueues deploy job
         │
         ▼
DeploymentsProcessor.handleDeploy() ← BullMQ Worker
  1. Pull image from registry
  2. Decrypt env vars from DB (AES-256-GCM)
  3. docker create + start with:
     · Traefik labels (auto-routing)
     · Resource limits (CPU/memory)
     · Health check config
     · paas-network
  4. Wait for health check (up to 120s)
  5. Stop & remove old container (graceful 30s timeout)
  6. Update Deployment record (status=ACTIVE)
  7. Update Service.activeDeploymentId
```

## Database Schema

```
users
  id, email, password_hash, role, is_active, github_token (encrypted), created_at

api_keys
  id, user_id, name, key_hash, key_prefix, expires_at, last_used_at

projects
  id, owner_id, name, slug (unique), description, created_at

services
  id, project_id, name, git_url, git_branch, git_provider
  dockerfile_path, docker_context, port, replicas
  memory_limit_mb, cpu_limit, health_check_path
  status, active_deployment_id, auto_deploy

environment_vars
  id, service_id, key, encrypted_value (AES-256-GCM), is_secret

builds
  id, service_id, commit_sha, commit_message, commit_author, branch
  status, image_name, image_tag, log_path, error_message, duration_seconds

deployments
  id, service_id, build_id, version (int, increments per service)
  status, container_id, container_name, error_message, duration_seconds, deployed_by

domains
  id, service_id, hostname (unique), is_custom, status, ssl_enabled

api_keys ──► users (many-to-one)
services ──► projects (many-to-one)
environment_vars ──► services (many-to-one)
builds ──► services (many-to-one)
deployments ──► services, builds (many-to-one)
domains ──► services (many-to-one)
```

## Security Model

| Concern              | Implementation                                          |
|----------------------|---------------------------------------------------------|
| Auth                 | JWT (7d) + API Keys (SHA-256 hashed in DB)              |
| Env vars             | AES-256-GCM encryption, keys never returned via API     |
| GitHub token         | AES-256-GCM encrypted before storing                   |
| Webhook verification | HMAC-SHA256 + timing-safe comparison                    |
| Container isolation  | Each app: separate container, separate Docker network   |
| Resource limits      | CPU + memory limits enforced per container              |
| Rate limiting        | Traefik middleware (100 req/s burst 50 per container)   |
| Docker socket        | API container mounts socket, not exposed externally     |
| Secrets in logs      | Env var values never logged or returned in responses    |

## Scalability Path (Docker → Kubernetes)

### Phase 1: Current (Docker + Compose)
- Single server
- Docker Engine API via unix socket
- BullMQ for async builds/deploys
- Traefik for routing + SSL

### Phase 2: Multi-server (Swarm or separate build server)
- Move build workers to dedicated build server
- Use Docker Swarm or remote Docker daemon for deployments
- Shared registry already in place

### Phase 3: Kubernetes migration
```
DockerService → KubernetesService
  createAndStartContainer() → Deployment + Service resources
  stopContainer()           → scale replicas to 0
  removeContainer()         → delete Deployment

Traefik labels → Ingress annotations (Traefik on K8s or nginx-ingress)
BullMQ queues  → keep as-is (Redis is external)
Registry       → push to ECR/GCR/GHCR instead of local registry
```

The NestJS service layer is already abstracted so `DockerService` can be
replaced with a `KubernetesService` implementing the same interface, with
zero changes to the business logic in processors.
