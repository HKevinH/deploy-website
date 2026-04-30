import Link from 'next/link';
import { FolderOpen, Activity, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Project } from '@/lib/api';

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
  const running = project.services.filter((s) => s.status === 'running').length;
  const total = project.services.length;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors dark:bg-slate-800 dark:text-slate-300">
          <FolderOpen className="h-5 w-5" />
        </div>
        <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-brand-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
      </div>

      <h3 className="mb-1 font-semibold text-slate-950 dark:text-white">{project.name}</h3>
      <p className="mb-4 font-mono text-xs text-slate-500 dark:text-slate-400">{project.slug}</p>

      {project.description && (
        <p className="mb-4 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          <span>
            {total === 0 ? 'No services' : `${running}/${total} running`}
          </span>
        </div>
        <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
      </div>
    </Link>
  );
}
