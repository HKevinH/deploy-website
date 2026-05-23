# Plataforma PaaS - Documentacion

Esta carpeta explica como funciona la plataforma, con foco en el flujo completo de despliegue, Docker, Traefik, balanceo de cargas, replicas y observabilidad.

Version en ingles: [README.en.md](./README.en.md)

## Resumen

La plataforma funciona como un mini PaaS autoalojado. Permite registrar proyectos, conectar repositorios Git, construir imagenes Docker, desplegar contenedores y publicar servicios usando Traefik como proxy inverso y balanceador de cargas.

El objetivo principal es que un servicio no dependa de una sola instancia. Si un proyecto recibe mas trafico, se pueden crear varias replicas de la misma imagen y Traefik reparte las peticiones entre ellas.

## Componentes Principales

### Web

La aplicacion web esta en `apps/web`.

Sirve como panel de control para:

- Crear proyectos.
- Crear servicios desde repositorios Git.
- Configurar puerto y replicas.
- Lanzar builds y despliegues.
- Ver estado de contenedores.
- Revisar metricas, logs y configuracion global del balanceador.
- Usar el tutorial interactivo de exposicion en `/system`.

### API

El backend esta en `apps/api`.

Se encarga de:

- Autenticacion.
- Gestion de proyectos y servicios.
- Clonado de repositorios.
- Generacion automatica de Dockerfiles para proyectos Node/Next.js cuando no existe uno.
- Construccion de imagenes Docker.
- Despliegue de contenedores.
- Generacion de rutas dinamicas para Traefik.
- Lectura de metricas y estado del sistema.

### Docker

Docker se usa para:

- Ejecutar la propia plataforma (`api`, `web`, `postgres`, `redis`, `minio`, `registry`, `traefik`).
- Construir imagenes de los proyectos del usuario.
- Ejecutar cada despliegue como uno o mas contenedores.

### Traefik

Traefik es el punto de entrada HTTP/HTTPS.

Cumple dos funciones:

- Proxy inverso: recibe peticiones por dominio y las dirige al servicio correcto.
- Balanceador de cargas: cuando un servicio tiene varias replicas, reparte el trafico entre varios contenedores.

La configuracion base esta en:

```text
infrastructure/traefik/traefik.yml
```

La configuracion dinamica esta en:

```text
infrastructure/traefik/dynamic/
```

## Flujo de Build

1. El usuario crea un servicio desde la web.
2. La API clona el repositorio Git.
3. Si el repositorio no trae Dockerfile, la API intenta generar uno automaticamente.
4. La API empaqueta el contexto de build.
5. Docker construye la imagen.
6. La imagen queda etiquetada con el proyecto, servicio y commit.

Ejemplo de log esperado:

```text
Cloning repository
Repository cloned
Packaging build context
Generated Next.js Dockerfile
Building image
Image built
```

## Flujo de Deploy

1. La API toma la ultima imagen construida.
2. Lee la configuracion del servicio: puerto, variables de entorno, limites y replicas.
3. Crea uno o mas contenedores con la misma imagen.
4. Espera el health check si esta configurado.
5. Genera un archivo dinamico de Traefik para ese servicio.
6. Traefik detecta el archivo y publica el dominio.
7. El despliegue queda activo.

## Replicas

Una replica es otra instancia del mismo servicio.

Ejemplo:

```text
service: web
image: registry.localhost/proyecto/web:abc123
replicas: 2
```

Docker ejecuta:

```text
paas-project-service-v2-1
paas-project-service-v2-2
```

Ambos contenedores corren la misma imagen, pero Traefik los ve como servidores disponibles para el mismo servicio.

## Balanceador de Cargas

El balanceador de cargas real es Traefik.

Cuando hay dos replicas, la configuracion dinamica contiene algo similar a:

```yaml
http:
  routers:
    paas-service-id:
      rule: "Host(`mi-servicio.localhost`)"
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

Cada `server` es una replica. Traefik decide a cual enviar cada peticion.

## Configuracion Global del Balanceador

La configuracion global esta en:

```text
infrastructure/traefik/dynamic/load-balancer.yml
```

Ejemplo:

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

Conceptos:

- `retry`: reintenta peticiones fallidas.
- `inFlightReq`: limita cuantas peticiones simultaneas acepta el balanceador.
- `serversTransport`: define timeouts y conexiones reutilizables hacia los contenedores.
- `passHostHeader`: conserva el host original de la peticion.

## Observabilidad

La plataforma permite observar:

- Estado del API.
- Estado de Docker.
- Contenedores activos.
- CPU y memoria de los despliegues.
- Trafico por servicio.
- Metricas de Traefik.
- Configuracion global activa del balanceador.

Traefik expone metricas en:

```text
http://localhost:8082/metrics
```

La web muestra la configuracion del balanceador en:

```text
http://localhost:3001/system
```

## Como Exponerlo

Un guion simple para la presentacion:

1. Mostrar el problema: un solo contenedor puede saturarse.
2. Explicar Docker: cada servicio se ejecuta como contenedor.
3. Explicar imagenes: una imagen puede levantar varias instancias.
4. Explicar replicas: varias instancias del mismo servicio.
5. Explicar Traefik: recibe el trafico y decide a que replica enviarlo.
6. Mostrar `load-balancer.yml`: configuracion global.
7. Mostrar `/system`: tutorial interactivo y metricas.
8. Abrir los logs de Traefik para demostrar que las peticiones llegan a replicas diferentes.

## Comandos Utiles

Levantar la plataforma:

```bash
docker compose up -d --build
```

Ver contenedores:

```bash
docker compose ps
```

Ver logs de Traefik:

```bash
docker logs paas-traefik --tail 80
```

Ver metricas:

```bash
curl http://localhost:8082/metrics
```

Reconstruir solo web:

```bash
docker compose up -d --build web
```

Reconstruir API y Traefik:

```bash
docker compose up -d --build api traefik
```

## Idea Central

La plataforma no solo ejecuta proyectos en Docker. Tambien automatiza el despliegue, crea replicas, configura Traefik y permite observar el trafico. Eso convierte un repositorio Git en un servicio publicado con balanceo de cargas.
