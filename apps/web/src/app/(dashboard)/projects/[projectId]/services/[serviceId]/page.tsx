'use client';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Activity, ChevronRight, Cpu, HardDrive, Play, RefreshCw, RotateCcw, Save, Square, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { servicesApi, deploymentsApi, buildsApi, Service, Deployment } from '@/lib/api';
import { TranslationKey, useI18n } from '@/lib/i18n';
import DeploymentList from '@/components/deployments/DeploymentList';
import StatusBadge from '@/components/deployments/DeploymentStatus';
import ExecTerminal from '@/components/deployments/ExecTerminal';
import BuildLogsPanel from '@/components/deployments/BuildLogsPanel';

export default function ServiceDetailPage() {
  const { t } = useI18n();
  const { projectId, serviceId } = useParams<{ projectId: string; serviceId: string }>();
  const [view, setView] = useState<'deployments' | 'buildLogs' | 'terminal'>('deployments');
  const [portDraft, setPortDraft] = useState('');
  const [savingPort, setSavingPort] = useState(false);
  const [containerAction, setContainerAction] = useState<'start' | 'stop' | 'restart' | null>(null);

  const { data: service, mutate: mutateService } = useSWR<Service>(
    `service:${serviceId}`,
    () => servicesApi.get(serviceId).then((r) => r.data),
    { refreshInterval: 8000 },
  );

  const { data: deployments, mutate: mutateDeployments } = useSWR<Deployment[]>(
    `deployments:${serviceId}`,
    () => deploymentsApi.list(serviceId).then((r) => r.data),
    { refreshInterval: 5000 },
  );

  const { data: stats } = useSWR(
    service?.activeDeploymentId ? `stats:${service.activeDeploymentId}` : null,
    () => deploymentsApi.stats(serviceId, service!.activeDeploymentId!).then((r) => r.data),
    { refreshInterval: 10000 },
  );

  const activeDeployment = useMemo(
    () => deployments?.find((deployment) => deployment.id === service?.activeDeploymentId) ?? null,
    [deployments, service?.activeDeploymentId],
  );

  useEffect(() => {
    if (service) setPortDraft(String(service.port));
  }, [service?.port]);

  async function handleTriggerBuild() {
    try {
      await buildsApi.trigger(serviceId);
      toast.success(t('triggerBuildSuccess'));
      setView('buildLogs');
      mutateDeployments();
    } catch {
      toast.error(t('triggerBuildError'));
    }
  }

  async function handleRollback() {
    if (!confirm(t('rollbackConfirm'))) return;
    try {
      await deploymentsApi.rollback(serviceId);
      toast.success(t('rollbackSuccess'));
      mutateDeployments();
    } catch {
      toast.error(t('rollbackError'));
    }
  }

  async function handleSavePort() {
    const nextPort = Number(portDraft);
    if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
      toast.error(t('invalidPort'));
      return;
    }

    try {
      setSavingPort(true);
      await servicesApi.update(serviceId, { port: nextPort });
      toast.success(t('portUpdated'));
      mutateService();
    } catch {
      toast.error(t('portUpdateError'));
    } finally {
      setSavingPort(false);
    }
  }

  async function handleContainerAction(action: 'start' | 'stop' | 'restart') {
    if (!service) return;

    const activeDeploymentId = service.activeDeploymentId;
    if (!activeDeploymentId && action !== 'start') {
      toast.error(t('noActiveDeployment'));
      return;
    }

    try {
      setContainerAction(action);
      if (action === 'start' && activeDeploymentId) {
        await deploymentsApi.start(serviceId, activeDeploymentId);
      }
      if (action === 'start' && !activeDeploymentId) {
        await deploymentsApi.startLatest(serviceId);
      }
      if (action === 'stop' && activeDeploymentId) await deploymentsApi.stop(serviceId, activeDeploymentId);
      if (action === 'restart' && activeDeploymentId) await deploymentsApi.restart(serviceId, activeDeploymentId);
      toast.success(t(action === 'start' && !activeDeploymentId ? 'deploymentStarted' : action === 'start' ? 'containerStarted' : action === 'stop' ? 'containerStopped' : 'containerRestarted'));
      mutateService();
      mutateDeployments();
    } catch {
      toast.error(t('containerActionError'));
    } finally {
      setContainerAction(null);
    }
  }

  if (!service) {
    return <div className="p-8 animate-pulse"><div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800" /></div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/projects" className="hover:text-slate-950 dark:hover:text-white">{t('projects')}</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/projects/${projectId}`} className="hover:text-slate-950 dark:hover:text-white">{t('project')}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-950 dark:text-white">{service.name}</span>
      </div>

      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{service.name}</h1>
                <StatusBadge status={service.status} />
                {service.autoDeploy && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {t('autoDeploy')}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-mono">{service.gitBranch}</span>
                <span>{t('port')} {service.port}</span>
                {activeDeployment && <span>v{activeDeployment.version}</span>}
              </div>
              {service.domains?.[0] && (
                <a
                  href={`${service.domains[0].sslEnabled ? 'https' : 'http'}://${service.domains[0].hostname}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  {service.domains[0].hostname}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition-colors focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-950">
              <label htmlFor="service-port" className="border-r border-slate-200 px-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {t('port')}
              </label>
              <input
                id="service-port"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={portDraft}
                onChange={(e) => setPortDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="h-full w-20 bg-transparent px-3 text-sm font-semibold text-slate-950 outline-none dark:text-white"
              />
              <button
                onClick={handleSavePort}
                disabled={savingPort || portDraft === String(service.port)}
                className="inline-flex h-full w-10 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                title={t('savePort')}
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => handleContainerAction('start')}
              disabled={containerAction !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Play className={clsx('h-4 w-4', containerAction === 'start' && 'animate-pulse')} />
              {t('start')}
            </button>
            <button
              onClick={() => handleContainerAction('stop')}
              disabled={!service.activeDeploymentId || containerAction !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Square className="h-4 w-4" />
              {t('stop')}
            </button>
            <button
              onClick={() => handleContainerAction('restart')}
              disabled={!service.activeDeploymentId || containerAction !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={clsx('h-4 w-4', containerAction === 'restart' && 'animate-spin')} />
              {t('restart')}
            </button>
            <button
              onClick={handleRollback}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              {t('rollback')}
            </button>
            <button
              onClick={handleTriggerBuild}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700"
            >
              <RefreshCw className="h-4 w-4" />
              {t('deploy')}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={Cpu} label={t('cpu')} value={stats ? `${stats.cpuPercent.toFixed(1)}%` : t('idle')} />
        <MetricCard
          icon={HardDrive}
          label={t('memory')}
          value={stats ? `${(stats.memoryUsage / 1024 / 1024).toFixed(0)} MB` : t('idle')}
          hint={stats ? `${(stats.memoryLimit / 1024 / 1024).toFixed(0)} ${t('mbLimit')}` : undefined}
        />
        <MetricCard icon={Terminal} label={t('container')} value={service.activeDeploymentId ? t('ready') : t('waiting')} />
      </div>

      <ObservabilityCard
        service={service}
        deploymentCount={deployments?.length ?? 0}
        activeDeployment={activeDeployment}
        hasStats={Boolean(stats)}
        t={t}
      />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {[
          ['deployments', t('deployments')],
          ['buildLogs', t('buildLogs')],
          ['terminal', t('terminal')],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key as typeof view)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === key
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'deployments' ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('deployments')}</h2>
          </div>
          <DeploymentList
            deployments={deployments ?? []}
            serviceId={serviceId}
            activeDeploymentId={service.activeDeploymentId}
          />
        </div>
      ) : view === 'buildLogs' ? (
        <BuildLogsPanel serviceId={serviceId} />
      ) : (
        <ExecTerminal serviceId={serviceId} deploymentId={service.activeDeploymentId} />
      )}
    </div>
  );
}

function ObservabilityCard({
  service,
  deploymentCount,
  activeDeployment,
  hasStats,
  t,
}: {
  service: Service;
  deploymentCount: number;
  activeDeployment: Deployment | null;
  hasStats: boolean;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('observability')}</h2>
        <StatusBadge status={service.status} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <ObservationItem label={t('serviceStatus')} value={<StatusBadge status={service.status} />} />
        <ObservationItem label={t('deploymentCount')} value={String(deploymentCount)} />
        <ObservationItem
          label={t('activeVersion')}
          value={activeDeployment ? `v${activeDeployment.version}` : t('noActiveDeployment')}
        />
        <ObservationItem
          label={t('container')}
          value={hasStats ? t('liveMetrics') : t('waitingFirstDeployment')}
        />
      </div>
    </div>
  );
}

function ObservationItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-950 dark:text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}
