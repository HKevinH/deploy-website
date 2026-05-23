'use client';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Cpu,
  Gauge,
  GitBranch,
  HardDrive,
  Network,
  Play,
  Server,
  Shield,
  Timer,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LoadBalancerConfig, systemApi, SystemStatus } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type UiLanguage = 'en' | 'es';

const fetcher = () => systemApi.status().then((r) => r.data);
const loadBalancerFetcher = () => systemApi.loadBalancer().then((r) => r.data);

const copy = {
  en: {
    subtitle: 'Live API, Docker host, and container status.',
    systemLoadError: 'Could not load system status.',
    containers: 'Containers',
    memory: 'Memory',
    globalLoadBalancer: 'Global load balancer',
    enabled: 'enabled',
    missing: 'missing',
    managedRoutes: 'Managed routes',
    retryAttempts: 'Retry attempts',
    maxInFlight: 'Max in-flight',
    idleConnsPerHost: 'Idle conns/host',
    retryInterval: 'Retry interval',
    dialTimeout: 'Dial timeout',
    headerTimeout: 'Header timeout',
    loadBalancerMissing: 'load-balancer.yml not found',
    tutorialTitle: 'Presentation tutorial',
    tutorialSubtitle: 'Load balancing with Docker, Traefik, replicas, and metrics.',
    previous: 'Previous',
    next: 'Next',
    step: 'Step',
    of: 'of',
    suggestedScript: 'Suggested script',
    keyConcepts: 'Key concepts',
    loadingBalancer: 'Loading the real load balancer configuration...',
    policyMissing: 'The global policy has not been found in Traefik yet.',
    presenterLine: (routes: number, retries: number, requests: number) =>
      `${routes} routes use the global policy with ${retries} retries and a limit of ${requests} simultaneous requests.`,
    users: 'Users',
    requests: 'HTTP requests',
    proxyBalancer: 'Proxy + load balancer',
    dockerReplicas: 'Docker replicas',
    ready: 'ready',
    globalPolicy: 'Global policy',
    policyValue: 'retry + timeout + in-flight',
    metrics: 'Metrics',
    metricsValue: 'Prometheus + access logs',
    scaling: 'Scaling',
    scalingValue: 'replicas per service',
    yamlTitle: 'Active YAML',
  },
  es: {
    subtitle: 'Estado en vivo del API, Docker host y contenedores.',
    systemLoadError: 'No se pudo cargar el estado del sistema.',
    containers: 'Contenedores',
    memory: 'Memoria',
    globalLoadBalancer: 'Balanceador de cargas global',
    enabled: 'activo',
    missing: 'no encontrado',
    managedRoutes: 'Rutas administradas',
    retryAttempts: 'Reintentos',
    maxInFlight: 'Max. simultaneas',
    idleConnsPerHost: 'Conexiones idle/host',
    retryInterval: 'Intervalo de reintento',
    dialTimeout: 'Timeout de conexion',
    headerTimeout: 'Timeout de headers',
    loadBalancerMissing: 'No se encontro load-balancer.yml',
    tutorialTitle: 'Tutorial para exposicion',
    tutorialSubtitle: 'Balanceador de cargas con Docker, Traefik, replicas y metricas.',
    previous: 'Anterior',
    next: 'Siguiente',
    step: 'Paso',
    of: 'de',
    suggestedScript: 'Guion sugerido',
    keyConcepts: 'Conceptos clave',
    loadingBalancer: 'Cargando configuracion real del balanceador...',
    policyMissing: 'La politica global aun no fue encontrada en Traefik.',
    presenterLine: (routes: number, retries: number, requests: number) =>
      `${routes} rutas usan la politica global con ${retries} reintentos y limite de ${requests} peticiones simultaneas.`,
    users: 'Usuarios',
    requests: 'Peticiones HTTP',
    proxyBalancer: 'Proxy + balanceador',
    dockerReplicas: 'Replicas Docker',
    ready: 'listo',
    globalPolicy: 'Politica global',
    policyValue: 'retry + timeout + in-flight',
    metrics: 'Metricas',
    metricsValue: 'Prometheus + logs de acceso',
    scaling: 'Escalado',
    scalingValue: 'replicas por servicio',
    yamlTitle: 'YAML activo',
  },
} as const;

const tutorialSteps = (language: UiLanguage) => [
  {
    title: language === 'es' ? 'Problema' : 'Problem',
    subtitle: language === 'es' ? 'Un solo contenedor puede saturarse.' : 'A single container can become saturated.',
    icon: Gauge,
    focus: 'client',
    explanation:
      language === 'es'
        ? 'Cuando muchas personas entran al mismo proyecto, todas las peticiones llegan al mismo proceso. Si ese contenedor se demora, todos esperan.'
        : 'When many people access the same project, every request reaches the same process. If that container slows down, everyone waits.',
    say:
      language === 'es'
        ? 'Primero identificamos el problema: no queremos que una sola instancia cargue todo el trafico del proyecto.'
        : 'First we identify the problem: we do not want one instance to carry all project traffic.',
    bullets:
      language === 'es'
        ? ['Peticiones concurrentes', 'Riesgo de lentitud', 'Un unico punto de presion']
        : ['Concurrent requests', 'Risk of slowness', 'One pressure point'],
  },
  {
    title: language === 'es' ? 'Balanceador' : 'Load balancer',
    subtitle: language === 'es' ? 'Traefik recibe el trafico primero.' : 'Traefik receives traffic first.',
    icon: Network,
    focus: 'traefik',
    explanation:
      language === 'es'
        ? 'Traefik funciona como reverse proxy y load balancer. El usuario llama al dominio, no al contenedor, y Traefik decide a que replica enviar cada request.'
        : 'Traefik works as a reverse proxy and load balancer. The user calls the domain, not the container, and Traefik chooses which replica receives each request.',
    say:
      language === 'es'
        ? 'Usamos Traefik porque ya esta delante de los servicios, lee configuracion dinamica y reparte trafico entre varias replicas.'
        : 'We use Traefik because it already sits in front of services, reads dynamic configuration, and distributes traffic across replicas.',
    bullets:
      language === 'es'
        ? ['Reverse proxy', 'Load balancer', 'Rutas por dominio']
        : ['Reverse proxy', 'Load balancer', 'Domain-based routes'],
  },
  {
    title: language === 'es' ? 'Replicas' : 'Replicas',
    subtitle: language === 'es' ? 'La misma imagen corre varias veces.' : 'The same image runs multiple times.',
    icon: GitBranch,
    focus: 'replicas',
    explanation:
      language === 'es'
        ? 'Cuando el servicio tiene 2 replicas, el despliegue crea 2 contenedores con la misma imagen. Traefik registra ambos como servers del mismo servicio.'
        : 'When a service has 2 replicas, deployment creates 2 containers from the same image. Traefik registers both as servers for the same service.',
    say:
      language === 'es'
        ? 'No duplicamos codigo. Construimos una imagen y levantamos varias instancias de esa imagen.'
        : 'We do not duplicate code. We build one image and start multiple instances from that image.',
    bullets:
      language === 'es'
        ? ['Misma imagen', 'Varios contenedores', 'Un solo dominio publico']
        : ['Same image', 'Multiple containers', 'One public domain'],
  },
  {
    title: language === 'es' ? 'Politica global' : 'Global policy',
    subtitle:
      language === 'es'
        ? 'Una sola configuracion controla todos los servicios.'
        : 'One configuration controls all services.',
    icon: Shield,
    focus: 'policy',
    explanation:
      language === 'es'
        ? 'La configuracion global vive en load-balancer.yml. Ahi definimos reintentos, limite de peticiones simultaneas y timeouts.'
        : 'The global configuration lives in load-balancer.yml. There we define retries, simultaneous request limits, and timeouts.',
    say:
      language === 'es'
        ? 'La ventaja es que no configuramos cada proyecto a mano. Todos heredan la misma politica global.'
        : 'The advantage is that we do not configure each project manually. They all inherit the same global policy.',
    bullets: language === 'es' ? ['Retry', 'Max in-flight', 'Timeouts compartidos'] : ['Retry', 'Max in-flight', 'Shared timeouts'],
  },
  {
    title: language === 'es' ? 'Observabilidad' : 'Observability',
    subtitle:
      language === 'es'
        ? 'Vemos trafico y salud desde Docker y Traefik.'
        : 'We see traffic and health from Docker and Traefik.',
    icon: CheckCircle2,
    focus: 'metrics',
    explanation:
      language === 'es'
        ? 'Traefik expone metricas Prometheus y logs de acceso. La web consulta el API para mostrar estado, rutas administradas y configuracion activa.'
        : 'Traefik exposes Prometheus metrics and access logs. The web app queries the API to show status, managed routes, and active configuration.',
    say:
      language === 'es'
        ? 'Cerramos con observabilidad: no basta con balancear, tambien debemos poder verificar que esta funcionando.'
        : 'We close with observability: balancing is not enough, we must also verify that it works.',
    bullets:
      language === 'es'
        ? ['Metricas en /metrics', 'Logs de Traefik', 'Panel de sistema']
        : ['Metrics at /metrics', 'Traefik logs', 'System panel'],
  },
] as const;

export default function SystemPage() {
  const { t, language } = useI18n();
  const text = copy[language];
  const { data, error } = useSWR<SystemStatus>('/system/status', fetcher, { refreshInterval: 5000 });
  const { data: loadBalancer } = useSWR<LoadBalancerConfig>(
    '/system/load-balancer',
    loadBalancerFetcher,
    { refreshInterval: 10000 },
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{t('system')}</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{text.subtitle}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {text.systemLoadError}
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Metric icon={Server} label="API" value={data.api.status} />
            <Metric icon={Box} label={text.containers} value={`${data.docker.containersRunning}/${data.docker.containers}`} />
            <Metric icon={Cpu} label="CPUs" value={String(data.docker.cpus)} />
            <Metric icon={HardDrive} label={text.memory} value={`${Math.round(data.docker.memoryTotal / 1024 / 1024 / 1024)} GB`} />
          </div>

          <LoadBalancerTutorial loadBalancer={loadBalancer} language={language} />

          {loadBalancer && (
            <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-950 dark:text-white">{text.globalLoadBalancer}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{loadBalancer.path}</p>
                  </div>
                  <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {loadBalancer.enabled ? text.enabled : text.missing}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
                <Metric icon={Workflow} label={text.managedRoutes} value={String(loadBalancer.managedRoutes)} />
                <Metric icon={Shield} label={text.retryAttempts} value={String(loadBalancer.retryAttempts)} />
                <Metric icon={Network} label={text.maxInFlight} value={String(loadBalancer.maxInFlightRequests)} />
                <Metric icon={Timer} label={text.idleConnsPerHost} value={String(loadBalancer.maxIdleConnsPerHost)} />
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-5 text-sm dark:border-slate-800 md:grid-cols-3">
                <ConfigItem label={text.retryInterval} value={loadBalancer.retryInitialInterval} />
                <ConfigItem label={text.dialTimeout} value={loadBalancer.dialTimeout} />
                <ConfigItem label={text.headerTimeout} value={loadBalancer.responseHeaderTimeout} />
              </div>

              <div className="border-t border-slate-200 p-5 dark:border-slate-800">
                <div className="mb-2 text-sm font-semibold text-slate-950 dark:text-white">{text.yamlTitle}</div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {loadBalancer.raw || text.loadBalancerMissing}
                </pre>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-950 dark:text-white">{text.containers}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{data.docker.operatingSystem} - Docker {data.docker.serverVersion}</p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.containers.map((container) => (
                <div key={container.id} className="grid grid-cols-1 gap-2 px-5 py-4 text-sm md:grid-cols-[1fr_120px_1fr]">
                  <div>
                    <div className="font-medium text-slate-950 dark:text-white">{container.name}</div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{container.id.slice(0, 12)}</div>
                  </div>
                  <span className="w-fit rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">{container.status}</span>
                  <div className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{container.image}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LoadBalancerTutorial({ loadBalancer, language }: { loadBalancer?: LoadBalancerConfig; language: UiLanguage }) {
  const [currentStep, setCurrentStep] = useState(0);
  const text = copy[language];
  const steps = tutorialSteps(language);
  const step = steps[currentStep];
  const Icon = step.icon;
  const activeServers = Math.max(loadBalancer?.managedRoutes ?? 0, 1);

  const presenterLine = useMemo(() => {
    if (!loadBalancer) return text.loadingBalancer;
    if (!loadBalancer.enabled) return text.policyMissing;
    return text.presenterLine(loadBalancer.managedRoutes, loadBalancer.retryAttempts, loadBalancer.maxInFlightRequests);
  }, [loadBalancer, text]);

  function goTo(offset: number) {
    setCurrentStep((value) => Math.min(Math.max(value + offset, 0), steps.length - 1));
  }

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950 dark:text-white">{text.tutorialTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{text.tutorialSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={currentStep === 0}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {text.previous}
            </button>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={currentStep === steps.length - 1}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.next}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
          <div className="space-y-2">
            {steps.map((item, index) => {
              const StepIcon = item.icon;
              const active = index === currentStep;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-100'
                      : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-950'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                    <StepIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{index + 1}. {item.title}</span>
                    <span className="block text-xs opacity-75">{item.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">{text.step} {currentStep + 1} {text.of} {steps.length}</div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">{step.title}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{step.explanation}</p>
            </div>
          </div>

          <TrafficDiagram focus={step.focus} activeServers={activeServers} language={language} />

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Play className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                {text.suggestedScript}
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{step.say}</p>
              <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                {presenterLine}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">{text.keyConcepts}</div>
              <div className="space-y-2">
                {step.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrafficDiagram({ focus, activeServers, language }: { focus: string; activeServers: number; language: UiLanguage }) {
  const text = copy[language];
  const replicaCount = Math.max(Math.min(activeServers, 3), 2);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_48px_1fr_48px_1.2fr]">
        <DiagramNode active={focus === 'client'} icon={Server} title={text.users} detail={text.requests} />
        <DiagramArrow />
        <DiagramNode active={focus === 'traefik' || focus === 'policy'} icon={Network} title="Traefik" detail={text.proxyBalancer} />
        <DiagramArrow />
        <div className={`rounded-lg border p-3 transition ${focus === 'replicas' || focus === 'metrics' ? 'border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
            <Box className="h-4 w-4" />
            {text.dockerReplicas}
          </div>
          <div className="grid gap-2">
            {Array.from({ length: replicaCount }).map((_, index) => (
              <div key={index} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                <span>container-{index + 1}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{text.ready}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <DiagramBadge active={focus === 'policy'} label={text.globalPolicy} value={text.policyValue} />
        <DiagramBadge active={focus === 'metrics'} label={text.metrics} value={text.metricsValue} />
        <DiagramBadge active={focus === 'replicas'} label={text.scaling} value={text.scalingValue} />
      </div>
    </div>
  );
}

function DiagramNode({ active, icon: Icon, title, detail }: { active: boolean; icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className={`rounded-lg border p-4 transition ${active ? 'border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{detail}</div>
    </div>
  );
}

function DiagramArrow() {
  return (
    <div className="hidden justify-center text-slate-400 md:flex">
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

function DiagramBadge({ active, label, value }: { active: boolean; label: string; value: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${active ? 'border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'}`}>
      <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="mb-1 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</div>
      <div className="font-mono text-sm font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}
