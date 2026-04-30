'use client';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, Clock, GitCommit } from 'lucide-react';
import { Deployment } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import StatusBadge from './DeploymentStatus';
import LogViewer from './LogViewer';

interface Props {
  deployments: Deployment[];
  serviceId: string;
  activeDeploymentId: string | null;
}

export default function DeploymentList({ deployments, activeDeploymentId }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (deployments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {t('noDeployments')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deployments.map((d) => (
        <div
          key={d.id}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="w-8 shrink-0 rounded-md bg-slate-100 py-1 text-center font-mono text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                v{d.version}
              </div>
              <StatusBadge status={d.status} />
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <GitCommit className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{d.build?.commitSha?.slice(0, 7)}</span>
                {d.build?.commitMessage && (
                  <span className="truncate text-slate-400 dark:text-slate-500">- {d.build.commitMessage}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {d.durationSeconds && (
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="h-3 w-3" />
                  {d.durationSeconds}s
                </div>
              )}
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
              </span>
              {d.id === activeDeploymentId && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {t('active')}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform dark:text-slate-600 ${expanded === d.id ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {expanded === d.id && (
            <div className="border-t border-slate-200 dark:border-slate-800">
              <LogViewer deploymentId={d.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
