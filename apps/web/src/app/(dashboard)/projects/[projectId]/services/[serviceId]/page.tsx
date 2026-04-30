'use client';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Activity, ChevronRight, Cpu, HardDrive, RefreshCw, RotateCcw, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { servicesApi, deploymentsApi, buildsApi, Service, Deployment } from '@/lib/api';
import DeploymentList from '@/components/deployments/DeploymentList';
import StatusBadge from '@/components/deployments/DeploymentStatus';
import ExecTerminal from '@/components/deployments/ExecTerminal';

export default function ServiceDetailPage() {
  const { projectId, serviceId } = useParams<{ projectId: string; serviceId: string }>();
  const [view, setView] = useState<'deployments' | 'terminal'>('deployments');

  const { data: service } = useSWR<Service>(
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

  async function handleTriggerBuild() {
    try {
      await buildsApi.trigger(serviceId);
      toast.success('Build triggered');
      mutateDeployments();
    } catch {
      toast.error('Failed to trigger build');
    }
  }

  async function handleRollback() {
    if (!confirm('Roll back to the previous deployment?')) return;
    try {
      await deploymentsApi.rollback(serviceId);
      toast.success('Rollback initiated');
      mutateDeployments();
    } catch {
      toast.error('Failed to rollback');
    }
  }

  if (!service) {
    return <div className="p-8 animate-pulse"><div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800" /></div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/projects" className="hover:text-slate-950 dark:hover:text-white">Projects</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/projects/${projectId}`} className="hover:text-slate-950 dark:hover:text-white">Project</Link>
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
                    auto deploy
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-mono">{service.gitBranch}</span>
                <span>port {service.port}</span>
                {activeDeployment && <span>v{activeDeployment.version}</span>}
              </div>
              {service.domains?.[0] && (
                <a
                  href={`https://${service.domains[0].hostname}`}
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
            <button
              onClick={handleRollback}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Rollback
            </button>
            <button
              onClick={handleTriggerBuild}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700"
            >
              <RefreshCw className="h-4 w-4" />
              Deploy
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={Cpu} label="CPU" value={stats ? `${stats.cpuPercent.toFixed(1)}%` : 'idle'} />
        <MetricCard
          icon={HardDrive}
          label="Memory"
          value={stats ? `${(stats.memoryUsage / 1024 / 1024).toFixed(0)} MB` : 'idle'}
          hint={stats ? `${(stats.memoryLimit / 1024 / 1024).toFixed(0)} MB limit` : undefined}
        />
        <MetricCard icon={Terminal} label="Container" value={service.activeDeploymentId ? 'ready' : 'waiting'} />
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {[
          ['deployments', 'Deployments'],
          ['terminal', 'Terminal'],
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
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Deployments</h2>
          </div>
          <DeploymentList
            deployments={deployments ?? []}
            serviceId={serviceId}
            activeDeploymentId={service.activeDeploymentId}
          />
        </div>
      ) : (
        <ExecTerminal serviceId={serviceId} deploymentId={service.activeDeploymentId} />
      )}
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
