# PaaS Platform - Documentation

This folder explains how the platform works, focusing on the complete deployment flow, Docker, Traefik, load balancing, replicas, and observability.

Spanish version: [README.md](./README.md)

Diagrams: [DIAGRAMS.en.md](./DIAGRAMS.en.md)

## Overview

The platform works as a small self-hosted PaaS. It lets users register projects, connect Git repositories, build Docker images, deploy containers, and publish services through Traefik as a reverse proxy and load balancer.

The main goal is to avoid depending on a single service instance. If a project receives more traffic, the platform can create multiple replicas of the same image and Traefik distributes requests across them.

## Main Components

### Web

The web application lives in `apps/web`.

It acts as the control panel to:

- Create projects.
- Create services from Git repositories.
- Configure ports and replicas.
- Trigger builds and deployments.
- See container status.
- Review metrics, logs, and the global load balancer configuration.
- Use the interactive presentation tutorial at `/system`.

### API

The backend lives in `apps/api`.

It handles:

- Authentication.
- Project and service management.
- Repository cloning.
- Automatic Dockerfile generation for Node/Next.js projects when no Dockerfile exists.
- Docker image builds.
- Container deployments.
- Dynamic Traefik route generation.
- System and metrics inspection.

### Docker

Docker is used to:

- Run the platform itself (`api`, `web`, `postgres`, `redis`, `minio`, `registry`, `traefik`).
- Build user project images.
- Run each deployment as one or more containers.

### Traefik

Traefik is the HTTP/HTTPS entry point.

It has two jobs:

- Reverse proxy: receives requests by domain and routes them to the correct service.
- Load balancer: when a service has multiple replicas, it distributes traffic across multiple containers.

The base configuration is located at:

```text
infrastructure/traefik/traefik.yml
```

The dynamic configuration is located at:

```text
infrastructure/traefik/dynamic/
```

## Build Flow

1. The user creates a service from the web app.
2. The API clones the Git repository.
3. If the repository has no Dockerfile, the API tries to generate one automatically.
4. The API packages the build context.
5. Docker builds the image.
6. The image is tagged with project, service, and commit information.

Expected log example:

```text
Cloning repository
Repository cloned
Packaging build context
Generated Next.js Dockerfile
Building image
Image built
```

## Deploy Flow

1. The API takes the latest built image.
2. It reads the service configuration: port, environment variables, limits, and replicas.
3. It creates one or more containers with the same image.
4. It waits for the health check if configured.
5. It generates a dynamic Traefik file for that service.
6. Traefik detects the file and publishes the domain.
7. The deployment becomes active.

## Replicas

A replica is another instance of the same service.

Example:

```text
service: web
image: registry.localhost/project/web:abc123
replicas: 2
```

Docker runs:

```text
paas-project-service-v2-1
paas-project-service-v2-2
```

Both containers run the same image, but Traefik sees them as available servers for the same service.

## Load Balancer

The actual load balancer is Traefik.

When there are two replicas, the dynamic configuration contains something similar to:

```yaml
http:
  routers:
    paas-service-id:
      rule: "Host(`my-service.localhost`)"
      entryPoints:
        - web
      middlewares:
        - paas-lb-chain@file
      service: paas-service-id

  services:
    paas-service-id:
      loadBalancer:
        passHostHeader: true
        serversTransport: paas-default-lb@file
        responseForwarding:
          flushInterval: 100ms
        servers:
          - url: "http://container-1:3000"
          - url: "http://container-2:3000"
```

Each `server` is a replica. Traefik decides where each request goes.

## Global Load Balancer Configuration

The global configuration is located at:

```text
infrastructure/traefik/dynamic/load-balancer.yml
```

Example:

```yaml
http:
  middlewares:
    paas-lb-chain:
      chain:
        middlewares:
          - paas-lb-retry
          - paas-lb-inflight

    paas-lb-retry:
      retry:
        attempts: 3
        initialInterval: 100ms

    paas-lb-inflight:
      inFlightReq:
        amount: 1000

  serversTransports:
    paas-default-lb:
      maxIdleConnsPerHost: 200
      forwardingTimeouts:
        dialTimeout: 30s
        responseHeaderTimeout: 30s
        idleConnTimeout: 90s
```

Concepts:

- `retry`: retries failed requests.
- `inFlightReq`: limits simultaneous requests accepted by the load balancer.
- `serversTransport`: defines timeouts and reusable connections to containers.
- `passHostHeader`: preserves the original request host.

## Observability

The platform can observe:

- API status.
- Docker status.
- Running containers.
- Deployment CPU and memory.
- Per-service traffic.
- Traefik metrics.
- Active global load balancer configuration.

Traefik exposes metrics at:

```text
http://localhost:8082/metrics
```

The web app shows the load balancer configuration at:

```text
http://localhost:3001/system
```

## How to Present It

A simple presentation script:

1. Show the problem: one container can become saturated.
2. Explain Docker: each service runs as a container.
3. Explain images: one image can start multiple instances.
4. Explain replicas: multiple instances of the same service.
5. Explain Traefik: it receives traffic and chooses which replica receives each request.
6. Show `load-balancer.yml`: the global policy.
7. Show `/system`: interactive tutorial and metrics.
8. Open Traefik logs to prove requests are reaching different replicas.

## Useful Commands

Start the platform:

```bash
docker compose up -d --build
```

List containers:

```bash
docker compose ps
```

See Traefik logs:

```bash
docker logs paas-traefik --tail 80
```

See metrics:

```bash
curl http://localhost:8082/metrics
```

Rebuild only web:

```bash
docker compose up -d --build web
```

Rebuild API and Traefik:

```bash
docker compose up -d --build api traefik
```

## Core Idea

The platform does more than run projects in Docker. It automates deployment, creates replicas, configures Traefik, and lets users observe traffic. That turns a Git repository into a published service with load balancing.
