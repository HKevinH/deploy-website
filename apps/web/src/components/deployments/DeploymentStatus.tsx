import { clsx } from 'clsx';

interface Props {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string; dot?: string }> = {
  running:   { label: 'Running',   classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400 animate-pulse' },
  active:    { label: 'Active',    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400 animate-pulse' },
  building:  { label: 'Building',  classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',   dot: 'bg-yellow-400 animate-ping' },
  deploying: { label: 'Deploying', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',         dot: 'bg-blue-400 animate-pulse' },
  failed:    { label: 'Failed',    classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  stopped:   { label: 'Stopped',   classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  idle:      { label: 'Idle',      classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
  pending:   { label: 'Pending',   classes: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  success:   { label: 'Success',   classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
};

export default function StatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.classes,
        className,
      )}
    >
      {config.dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      )}
      {config.label}
    </span>
  );
}
