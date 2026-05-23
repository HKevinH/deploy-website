'use client';
import useSWR from 'swr';
import { Server, Box, Cpu, HardDrive, Network, Shield, Timer, Workflow } from 'lucide-react';
import { LoadBalancerConfig, systemApi, SystemStatus } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const fetcher = () => systemApi.status().then((r) => r.data);
const loadBalancerFetcher = () => systemApi.loadBalancer().then((r) => r.data);

export default function SystemPage() {
  const { t } = useI18n();
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
        <p className="mt-1 text-slate-500 dark:text-slate-400">Live API, Docker host, and container status.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">Could not load system status.</div>}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Metric icon={Server} label="API" value={data.api.status} />
            <Metric icon={Box} label="Containers" value={`${data.docker.containersRunning}/${data.docker.containers}`} />
            <Metric icon={Cpu} label="CPUs" value={String(data.docker.cpus)} />
            <Metric icon={HardDrive} label="Memory" value={`${Math.round(data.docker.memoryTotal / 1024 / 1024 / 1024)} GB`} />
          </div>

          {loadBalancer && (
            <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-950 dark:text-white">Global load balancer</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{loadBalancer.path}</p>
                  </div>
                  <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {loadBalancer.enabled ? 'enabled' : 'missing'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
                <Metric icon={Workflow} label="Managed routes" value={String(loadBalancer.managedRoutes)} />
                <Metric icon={Shield} label="Retry attempts" value={String(loadBalancer.retryAttempts)} />
                <Metric icon={Network} label="Max in-flight" value={String(loadBalancer.maxInFlightRequests)} />
                <Metric icon={Timer} label="Idle conns/host" value={String(loadBalancer.maxIdleConnsPerHost)} />
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-5 text-sm dark:border-slate-800 md:grid-cols-3">
                <ConfigItem label="Retry interval" value={loadBalancer.retryInitialInterval} />
                <ConfigItem label="Dial timeout" value={loadBalancer.dialTimeout} />
                <ConfigItem label="Header timeout" value={loadBalancer.responseHeaderTimeout} />
              </div>

              <div className="border-t border-slate-200 p-5 dark:border-slate-800">
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {loadBalancer.raw || 'load-balancer.yml not found'}
                </pre>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-950 dark:text-white">Containers</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{data.docker.operatingSystem} · Docker {data.docker.serverVersion}</p>
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

function Metric({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
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
