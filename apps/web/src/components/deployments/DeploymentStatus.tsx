'use client';
import { clsx } from 'clsx';
import { TranslationKey, useI18n } from '@/lib/i18n';

interface Props {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { labelKey: TranslationKey; classes: string; dot?: string }> = {
  running:   { labelKey: 'statusRunning',   classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400 animate-pulse' },
  active:    { labelKey: 'statusActive',    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400 animate-pulse' },
  building:  { labelKey: 'statusBuilding',  classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',   dot: 'bg-yellow-400 animate-ping' },
  deploying: { labelKey: 'statusDeploying', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',         dot: 'bg-blue-400 animate-pulse' },
  failed:    { labelKey: 'statusFailed',    classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  stopped:   { labelKey: 'statusStopped',   classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  idle:      { labelKey: 'statusIdle',      classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  pending:   { labelKey: 'statusPending',   classes: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  success:   { labelKey: 'statusSuccess',   classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cancelled: { labelKey: 'statusCancelled', classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
};

export default function StatusBadge({ status, className }: Props) {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  const classes = config?.classes ?? 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
  const label = config ? t(config.labelKey) : status;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        classes,
        className,
      )}
    >
      {config?.dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      )}
      {label}
    </span>
  );
}
