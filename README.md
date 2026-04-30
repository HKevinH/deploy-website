# PaaS Platform

Self-hosted deployment platform similar to Railway/Render. Built with NestJS, Next.js, Docker Engine API, Traefik, and BullMQ.

## Stack

| Layer       | Technology                                     |
|-------------|------------------------------------------------|
| Frontend    | Next.js 14, Tailwind CSS, SWR, Zustand         |
| Backend     | NestJS 10, TypeORM, Passport, BullMQ           |
| Database    | PostgreSQL 16                                  |
| Queue       | Redis 7 + Bull/BullMQ                          |
| Storage     | MinIO (S3-compatible, build logs)              |
| Proxy       | Traefik v3 (SSL, routing, rate limiting)       |
| Registry    | Docker Registry v2 (private)                   |
| Container   | Docker Engine API via dockerode                |
| Git         | simple-git + GitHub webhooks                   |

## Quick Start (Development)

```bash
# 1. Clone and install
git clone <repo>
cd paas-platform
pnpm install

# 2. Start infrastructure
docker compose up -d postgres redis minio registry traefik

# 3. Copy env file
cp apps/api/.env.example apps/api/.env

# 4. Run API
pnpm api:dev

# 5. Run frontend
pnpm web:dev
```

Access:
- Dashboard: http://localhost:3001
- API + Swagger: http://localhost:3000/docs
- Traefik dashboard: http://traefik.localhost:8080
- MinIO console: http://minio.localhost

## Production Deploy

```bash
# 1. Create .env from template
cp apps/api/.env.example .env
# Fill all values (strong JWT_SECRET, 32-char ENCRYPTION_KEY, etc.)

# 2. Build and start everything
docker compose -f docker-compose.prod.yml up -d

# 3. Traefik handles SSL automatically via Let's Encrypt
```

## API Endpoints

```
POST   /v1/auth/register
POST   /v1/auth/login
GET    /v1/auth/me
POST   /v1/auth/api-keys

GET    /v1/projects
POST   /v1/projects
GET    /v1/projects/:id
PATCH  /v1/projects/:id
DELETE /v1/projects/:id

GET    /v1/projects/:projectId/services
POST   /v1/projects/:projectId/services
GET    /v1/projects/:projectId/services/:id
PATCH  /v1/projects/:projectId/services/:id

GET    /v1/services/:id/env
PUT    /v1/services/:id/env
DELETE /v1/services/:id/env/:key

GET    /v1/services/:id/builds
POST   /v1/services/:id/builds/trigger
GET    /v1/services/:id/builds/:buildId
GET    /v1/services/:id/builds/:buildId/logs/download

GET    /v1/services/:id/deployments
POST   /v1/services/:id/deployments/rollback
GET    /v1/services/:id/deployments/:dId
POST   /v1/services/:id/deployments/:dId/restart
GET    /v1/services/:id/deployments/:dId/stats

GET    /v1/services/:id/domains
POST   /v1/services/:id/domains
DELETE /v1/services/:id/domains/:domainId

POST   /v1/webhooks/github/:serviceId

# WebSocket (Socket.IO namespace: /logs)
subscribe:build        { buildId }
subscribe:deploy       { deploymentId }
stream:container-logs  { deploymentId, tail? }
stop:container-logs
```

## GitHub Webhook Setup

1. Go to your GitHub repo → Settings → Webhooks
2. Payload URL: `https://api.yourdomain.com/v1/webhooks/github/<serviceId>`
3. Content type: `application/json`
4. Secret: same as `GITHUB_WEBHOOK_SECRET` in your `.env`
5. Events: select **"Just the push event"**
