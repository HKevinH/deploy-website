# Diagramas de Funcionamiento

Estos diagramas explican como se conectan Docker, la API, Traefik, las replicas y las metricas dentro de la plataforma.

Version en ingles: [DIAGRAMS.en.md](./DIAGRAMS.en.md)

## 1. Arquitectura General

```mermaid
flowchart LR
  User[Usuario / Navegador] --> Web[Web App<br/>Next.js]
  Web --> API[API<br/>NestJS]
  API --> Postgres[(PostgreSQL)]
  API --> Redis[(Redis / Queue)]
  API --> Minio[(MinIO<br/>Logs y objetos)]
  API --> Docker[Docker Engine]
  Docker --> Registry[(Registry local)]
  Docker --> Apps[Contenedores de proyectos]
  User --> Traefik[Traefik<br/>Proxy + Load Balancer]
  Traefik --> Apps
```

La web administra la plataforma. La API orquesta builds y despliegues. Docker ejecuta la plataforma y los proyectos. Traefik recibe el trafico externo y lo dirige al servicio correcto.

## 2. Flujo de Build

```mermaid
sequenceDiagram
  participant User as Usuario
  participant Web as Web App
  participant API as API
  participant Git as Git Repository
  participant Docker as Docker Engine
  participant Registry as Registry local

  User->>Web: Click en Deploy / Build
  Web->>API: Solicita build del servicio
  API->>Git: Clona repositorio y rama
  Git-->>API: Codigo fuente
  API->>API: Detecta Dockerfile o genera uno
  API->>Docker: Envia contexto de build
  Docker->>Docker: Construye imagen
  Docker->>Registry: Etiqueta / guarda imagen
  API-->>Web: Build exitoso o fallido
```

La API no ejecuta el codigo directamente. Primero crea una imagen Docker reproducible. Esa imagen sera la base del despliegue.

## 3. Flujo de Deploy con Replicas

```mermaid
sequenceDiagram
  participant User as Usuario
  participant Web as Web App
  participant API as API
  participant Docker as Docker Engine
  participant Traefik as Traefik

  User->>Web: Inicia despliegue
  Web->>API: Desplegar ultima imagen
  API->>API: Lee puerto, variables y replicas
  loop Por cada replica
    API->>Docker: Crear contenedor desde la imagen
    Docker-->>API: containerId
    API->>Docker: Esperar health check
  end
  API->>API: Genera archivo dinamico de Traefik
  API->>Traefik: Traefik detecta cambio por provider file
  Traefik-->>Web: Servicio publicado
```

Si el servicio tiene `replicas = 2`, la API crea dos contenedores con la misma imagen y luego Traefik los registra como servidores del mismo servicio.

## 4. Balanceador de Cargas

```mermaid
flowchart LR
  Client1[Cliente A] --> Domain[dominio.localhost]
  Client2[Cliente B] --> Domain
  Client3[Cliente C] --> Domain

  Domain --> Traefik[Traefik Load Balancer]

  Traefik --> R1["Replica 1<br/>container-v2-1 puerto 3000"]
  Traefik --> R2["Replica 2<br/>container-v2-2 puerto 3000"]
  Traefik --> R3["Replica 3<br/>container-v2-3 puerto 3000"]
```

El usuario solo conoce el dominio. Traefik conoce las replicas internas y reparte las peticiones entre ellas.

## 5. Configuracion Global del Balanceador

```mermaid
flowchart TB
  LB["load-balancer.yml"] --> Chain["paas-lb-chain"]
  Chain --> Retry["paas-lb-retry<br/>attempts 3"]
  Chain --> InFlight["paas-lb-inflight<br/>amount 1000"]
  LB --> Transport["paas-default-lb<br/>timeouts e idle connections"]

  Route["Archivo dinamico del servicio<br/>paas-service.yml"] --> ChainRef["middleware global<br/>paas-lb-chain"]
  Route --> TransportRef["transport global<br/>paas-default-lb"]
  ChainRef --> Chain
  TransportRef --> Transport
```

La configuracion global evita repetir politicas en cada servicio. Cada ruta generada referencia `paas-lb-chain@file` y `paas-default-lb@file`.

## 6. Archivos de Traefik

```mermaid
flowchart TD
  TraefikYml[traefik.yml<br/>Configuracion base] --> FileProvider[File provider<br/>/etc/traefik/dynamic]
  FileProvider --> GlobalLB[load-balancer.yml<br/>Politica global]
  FileProvider --> RouteA[paas-service-a.yml<br/>Ruta + replicas]
  FileProvider --> RouteB[paas-service-b.yml<br/>Ruta + replicas]

  RouteA --> ServiceA[Servicio A]
  RouteB --> ServiceB[Servicio B]
```

`traefik.yml` dice donde buscar configuracion dinamica. Los archivos `paas-*.yml` son generados por la API durante el despliegue.

## 7. Observabilidad

```mermaid
flowchart LR
  Traefik[Traefik] --> Metrics["Prometheus metrics<br/>puerto 8082 metrics"]
  Traefik --> AccessLogs[Access logs]
  Docker[Docker Engine] --> Stats[CPU / Memoria<br/>por contenedor]
  API[API] --> Metrics
  API --> Stats
  API --> LBConfig[load-balancer.yml]
  Web[Web /system] --> API
```

La pantalla `/system` consulta la API. La API lee Docker, Traefik y el archivo global del balanceador para mostrar el estado real.

## 8. Mapa Mental para Exponer

```mermaid
mindmap
  root((PaaS con Docker))
    Build
      Clonar repositorio
      Generar Dockerfile si falta
      Construir imagen
    Deploy
      Leer configuracion
      Crear replicas
      Health check
    Traefik
      Proxy inverso
      Balanceador
      Rutas dinamicas
    Observabilidad
      Logs
      Metricas
      Estado de contenedores
    Web
      Panel de control
      Tutorial
      Configuracion visible
```

## 9. Resumen Visual

```mermaid
flowchart LR
  Repo[Repositorio Git] --> Build[Build Docker]
  Build --> Image[Imagen Docker]
  Image --> Deploy[Deploy]
  Deploy --> C1[Replica 1]
  Deploy --> C2[Replica 2]
  Deploy --> C3[Replica N]
  C1 --> LB[Traefik]
  C2 --> LB
  C3 --> LB
  LB --> Users[Usuarios]
  LB --> Metrics[Metricas]
```

La idea central: un repositorio se convierte en una imagen; una imagen se convierte en varias replicas; Traefik publica el dominio y reparte el trafico.
