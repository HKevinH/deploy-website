import Link from 'next/link';
import { Activity, ChevronRight, FolderOpen, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Project } from '@/lib/api';

interface Props {
  project: Project;
  onDelete?: (project: Project) => void;
}

export default function ProjectCard({ project, onDelete }: Props) {
  const running = project.services.filter((s) => s.status === 'running').length;
  const total = project.services.length;

  return (
    <article className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700/60">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors dark:bg-slate-800 dark:text-brand-100"
        >
          <FolderOpen className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(project)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
              title="Delete project"
              aria-label={`Delete ${project.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <Link href={`/projects/${project.id}`} aria-label={`Open ${project.name}`}>
            <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-brand-300" />
          </Link>
        </div>
      </div>

      <Link href={`/projects/${project.id}`} className="block">
        <h3 className="mb-1 font-semibold text-slate-950 dark:text-white">{project.name}</h3>
        <p className="mb-4 font-mono text-xs text-slate-500 dark:text-slate-400">{project.slug}</p>

        {project.description && (
          <p className="mb-4 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span>
              {total === 0 ? 'No services' : `${running}/${total} running`}
            </span>
          </div>
          <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
        </div>
      </Link>
    </article>
  );
}
