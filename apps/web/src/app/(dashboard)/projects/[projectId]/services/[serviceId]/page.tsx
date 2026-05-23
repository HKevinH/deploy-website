'use client';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Activity, BarChart3, ChevronRight, Cpu, HardDrive, Network, Play, RefreshCw, RotateCcw, Save, Server, ShieldAlert, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { servicesApi, deploymentsApi, buildsApi, Service, Deployment, TrafficStats } from '@/lib/api';
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
  const [replicasDraft, setReplicasDraft] = useState('');
  const [lbMaxInFlightDraft, setLbMaxInFlightDraft] = useState('');
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

  const { data: traffic } = useSWR(
    service?.activeDeploymentId ? `traffic:${service.activeDeploymentId}` : null,
    () => deploymentsApi.traffic(serviceId, service!.activeDeploymentId!).then((r) => r.data),
    { refreshInterval: 2000 },
  );

  const activeDeployment = useMemo(
    () => deployments?.find((deployment) => deployment.id === service?.activeDeploymentId) ?? null,
    [deployments, service?.activeDeploymentId],
  );

  useEffect(() => {
    if (!service) return;
    setPortDraft(String(service.port));
    setReplicasDraft(String(service.replicas ?? 1));
    setLbMaxInFlightDraft(String(service.lbMaxInFlight ?? 1000));
  }, [service?.port, service?.replicas, service?.lbMaxInFlight]);

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
    const nextReplicas = Number(replicasDraft);
    const nextLbMaxInFlight = Number(lbMaxInFlightDraft);
    if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
      toast.error(t('invalidPort'));
      return;
    }
    if (!Number.isInteger(nextReplicas) || nextReplicas < 1 || nextReplicas > 10) {
      toast.error(t('invalidReplicas'));
      return;
    }
    if (!Number.isInteger(nextLbMaxInFlight) || nextLbMaxInFlight < 1 || nextLbMaxInFlight > 100000) {
      toast.error(t('invalidLbMaxInFlight'));
      return;
    }

    try {
      setSavingPort(true);
      await servicesApi.update(serviceId, {
        port: nextPort,
        replicas: nextReplicas,
        lbMaxInFlight: nextLbMaxInFlight,
      });
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
                <span>{t('replicas')} {service.replicas ?? 1}</span>
                <span>{t('lbMaxInFlight')} {service.lbMaxInFlight ?? 1000}</span>
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
                disabled={
                  savingPort ||
                  (
                    portDraft === String(service.port) &&
                    replicasDraft === String(service.replicas ?? 1) &&
                    lbMaxInFlightDraft === String(service.lbMaxInFlight ?? 1000)
                  )
                }
                className="inline-flex h-full w-10 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                title={t('saveRuntime')}
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition-colors focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-950">
              <label htmlFor="service-replicas" className="border-r border-slate-200 px-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {t('replicas')}
              </label>
              <input
                id="service-replicas"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={replicasDraft}
                onChange={(e) => setReplicasDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className="h-full w-14 bg-transparent px-3 text-sm font-semibold text-slate-950 outline-none dark:text-white"
              />
            </div>
            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm transition-colors focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-950">
              <label htmlFor="service-lb-max" className="border-r border-slate-200 px-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {t('lbMaxInFlight')}
              </label>
              <input
                id="service-lb-max"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={lbMaxInFlightDraft}
                onChange={(e) => setLbMaxInFlightDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-full w-20 bg-transparent px-3 text-sm font-semibold text-slate-950 outline-none dark:text-white"
              />
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
        <MetricCard
          icon={Network}
          label={t('requests')}
          value={traffic?.available ? traffic.requestsTotal.toFixed(0) : '0'}
          hint={traffic?.available ? Object.entries(traffic.requestsByCode).map(([code, count]) => `${code}: ${count}`).join(' | ') : undefined}
        />
      </div>

      <ObservabilityCard
        service={service}
        deploymentCount={deployments?.length ?? 0}
        activeDeployment={activeDeployment}
        hasStats={Boolean(stats)}
        t={t}
      />

      <LoadBalancerCard service={service} traffic={traffic} t={t} />

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
          value={hasStats ? `${service.replicas ?? 1} ${t('replicas').toLowerCase()}` : t('waitingFirstDeployment')}
        />
      </div>
    </div>
  );
}

function LoadBalancerCard({
  service,
  traffic,
  t,
}: {
  service: Service;
  traffic?: TrafficStats;
  t: (key: TranslationKey) => string;
}) {
  const replicas = traffic?.replicaRequests ?? [];
  const rejected = replicas.filter((replica) => replica.target === 'unknown');
  const routedReplicas = replicas.filter((replica) => replica.target !== 'unknown');
  const maxRequests = traffic?.lbMaxInFlight ?? service.lbMaxInFlight ?? 1000;
  const sampleSize = traffic?.sampleSize ?? 0;
  const routedRequests = routedReplicas.reduce((sum, replica) => sum + replica.requests, 0);
  const rejectedRequests = rejected.reduce((sum, replica) => sum + replica.requests, 0);
  const expectedReplicas = Math.max(service.replicas ?? routedReplicas.length ?? 1, 1);
  const slots = Array.from({ length: expectedReplicas }, (_, index) => {
    const replicaNumber = index + 1;
    return routedReplicas.find((replica) => getReplicaNumber(replica.target) === replicaNumber) ?? routedReplicas[index] ?? null;
  });
  const activeTargetCount = slots.filter(Boolean).length;
  const maxReplicaRequests = Math.max(...slots.map((replica) => replica?.requests ?? 0), 1);

  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('loadBalancer')}</h2>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('refreshEvery2s')}</span>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <LoadBalancerStat label={t('loadBalancerLimit')} value={maxRequests.toLocaleString()} />
          <LoadBalancerStat label={t('recentSample')} value={sampleSize.toLocaleString()} />
          <LoadBalancerStat label={t('routedRequests')} value={routedRequests.toLocaleString()} />
          <LoadBalancerStat label={t('activeTargets')} value={`${activeTargetCount}/${expectedReplicas}`} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('trafficFlow')}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {traffic?.available ? Object.entries(traffic.requestsByCode).map(([code, count]) => `${code}: ${count}`).join(' | ') : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <FlowNode label="HTTP" value={sampleSize.toLocaleString()} />
              <FlowArrow />
              <FlowNode label={t('loadBalancer')} value="Traefik" highlight />
              <FlowArrow />
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                {slots.map((replica, index) => (
                  <div
                    key={`${replica?.target ?? 'empty'}-${index}`}
                    className={clsx(
                      'rounded-lg border p-3',
                      replica
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Server className={clsx('h-4 w-4', replica ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400')} />
                      <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        {t('container')} {index + 1}
                      </span>
                    </div>
                    <div className="truncate font-mono text-xs font-semibold text-slate-950 dark:text-white">
                      {replica ? formatTarget(replica.target) : t('waiting')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('replicaDistribution')}</h3>
              {rejectedRequests > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {rejectedRequests.toLocaleString()} {t('rejectedTraffic').toLowerCase()}
                </span>
              )}
            </div>

            {slots.every((replica) => !replica) ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                {t('noTrafficYet')}
              </div>
            ) : (
              <div className="flex h-52 items-end gap-3 rounded-lg bg-white px-4 pb-4 pt-6 dark:bg-slate-900">
                {slots.map((replica, index) => {
                  const percentOfMax = ((replica?.requests ?? 0) / maxReplicaRequests) * 100;
                  return (
                    <div key={`${replica?.target ?? 'bar'}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className={clsx(
                            'w-full max-w-16 rounded-t-md transition-all duration-500',
                            getReplicaBarColor(index),
                          )}
                          style={{ height: `${replica ? Math.max(percentOfMax, 8) : 2}%` }}
                          title={replica ? `${replica.requests} ${t('requests').toLowerCase()}` : t('waiting')}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-950 dark:text-white">
                          {(replica?.requests ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t('container')} {index + 1}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t('containerTargets')}</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('targetReplica')}</span>
        </div>

        {slots.every((replica) => !replica) ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            {t('noTrafficYet')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {slots.map((replica, index) => (
              <ReplicaTargetCard
                key={`${replica?.target ?? 'target'}-${index}`}
                replica={replica}
                replicaNumber={index + 1}
                total={Math.max(routedRequests, 1)}
                t={t}
              />
            ))}
          </div>
        )}

        {rejectedRequests > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/25">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4" />
              {t('rejectedTraffic')}
            </div>
            <div className="space-y-2">
              {rejected.map((replica) => (
                <div key={replica.target} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900 dark:text-amber-100">
                  <span>{replica.requests.toLocaleString()} {t('requests').toLowerCase()} / {replica.percent.toFixed(1)}%</span>
                  <span className="text-xs opacity-80">
                    {t('statusCodes')}: {Object.entries(replica.statusCodes).map(([code, count]) => `${code} ${count}`).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadBalancerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function FlowNode({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={clsx(
        'min-w-24 rounded-lg border px-3 py-3 text-center',
        highlight
          ? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100'
          : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
      )}
    >
      <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function FlowArrow() {
  return <div className="h-px w-8 shrink-0 bg-slate-300 after:block after:h-2 after:w-2 after:translate-x-7 after:-translate-y-1 after:rotate-45 after:border-r after:border-t after:border-slate-300 dark:bg-slate-700 dark:after:border-slate-700" />;
}

function ReplicaTargetCard({
  replica,
  replicaNumber,
  total,
  t,
}: {
  replica: TrafficStats['replicaRequests'][number] | null;
  replicaNumber: number;
  total: number;
  t: (key: TranslationKey) => string;
}) {
  const requests = replica?.requests ?? 0;
  const percent = Math.round((requests / total) * 1000) / 10;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg text-white', getReplicaIconColor(replicaNumber - 1))}>
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              {t('container')} {replicaNumber}
            </div>
            <div className="break-all font-mono text-sm font-bold text-slate-950 dark:text-white">
              {replica ? formatTarget(replica.target) : t('waiting')}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-slate-950 dark:text-white">{requests.toLocaleString()}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{percent.toFixed(1)}%</div>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', getReplicaBarColor(replicaNumber - 1))}
          style={{ width: `${replica ? Math.max(percent, 4) : 0}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {replica && <span>{t('statusCodes')}: {Object.entries(replica.statusCodes).map(([code, count]) => `${code} ${count}`).join(', ')}</span>}
        {replica?.lastPath && <span className="break-all">{replica.lastPath}</span>}
      </div>
    </div>
  );
}

function getReplicaNumber(target: string): number | null {
  const match = target.match(/-(\d+):\d+$/);
  if (!match) return null;
  return Number(match[1]);
}

function formatTarget(target: string): string {
  return target.replace(/:\d+$/, '');
}

function getReplicaBarColor(index: number): string {
  return [
    'bg-emerald-500 dark:bg-emerald-400',
    'bg-sky-500 dark:bg-sky-400',
    'bg-violet-500 dark:bg-violet-400',
    'bg-amber-500 dark:bg-amber-400',
    'bg-rose-500 dark:bg-rose-400',
    'bg-cyan-500 dark:bg-cyan-400',
  ][index % 6];
}

function getReplicaIconColor(index: number): string {
  return [
    'bg-emerald-600',
    'bg-sky-600',
    'bg-violet-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-cyan-600',
  ][index % 6];
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
