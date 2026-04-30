'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Activity, ChevronRight, GitBranch, Globe, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, Project } from '@/lib/api';
import StatusBadge from '@/components/deployments/DeploymentStatus';

const fetcher = (id: string) => projectsApi.get(id).then((r) => r.data);

export default function ProjectDetailPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, error } = useSWR<Project>(
    projectId ? `/projects/${projectId}` : null,
    () => fetcher(projectId),
    { refreshInterval: 10000 },
  );

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}" and all its services?`)) return;

    try {
      await projectsApi.delete(project.id);
      toast.success('Project deleted');
      router.replace('/projects');
    } catch {
      toast.error('Failed to delete project');
    }
  }

  if (error) return <div className="p-8 text-rose-600 dark:text-rose-300">Failed to load project</div>;

  if (!project) return (
    <div className="p-8 animate-pulse">
      <div className="mb-4 h-8 w-48 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mb-8 h-4 w-96 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/projects" className="transition-colors hover:text-slate-950 dark:hover:text-white">Projects</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-950 dark:text-white">{project.name}</span>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{project.name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{project.slug}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <Link
            href={`/projects/${projectId}/services/new`}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Service
          </Link>
        </div>
      </div>

      {project.services.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-500 dark:text-slate-400">No services yet. Add your first service to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {project.services.map((service) => (
            <Link
              key={service.id}
              href={`/projects/${projectId}/services/${service.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700/60"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-100">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-950 dark:text-white">{service.name}</h3>
                    {service.gitUrl && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <GitBranch className="h-3 w-3" />
                        <span>{service.gitBranch}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {service.domains?.[0] && (
                    <div className="hidden items-center gap-1 text-xs text-slate-500 dark:text-slate-400 md:flex">
                      <Globe className="h-3 w-3" />
                      <span>{service.domains[0].hostname}</span>
                    </div>
                  )}
                  <StatusBadge status={service.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
