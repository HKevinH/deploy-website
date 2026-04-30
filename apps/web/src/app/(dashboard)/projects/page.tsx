'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Plus, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, Project } from '@/lib/api';
import ProjectCard from '@/components/dashboard/ProjectCard';

const fetcher = () => projectsApi.list().then((r) => r.data);

export default function ProjectsPage() {
  const { data: projects, error, mutate } = useSWR<Project[]>('/projects', fetcher);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await projectsApi.create({ name });
      toast.success('Project created');
      setShowCreate(false);
      setName('');
      mutate();
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.name}" and all its services?`)) return;

    setDeletingId(project.id);
    try {
      await projectsApi.delete(project.id);
      toast.success('Project deleted');
      mutate((current) => current?.filter((item) => item.id !== project.id), { revalidate: true });
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Projects</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your deployment projects</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">Create Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">Project name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="my-project"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Failed to load projects
        </div>
      )}

      {!projects && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      )}

      {projects?.length === 0 && (
        <div className="text-center py-20">
          <FolderOpen className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-700" />
          <p className="text-slate-500 dark:text-slate-400">No projects yet. Create your first one.</p>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className={deletingId === p.id ? 'pointer-events-none opacity-60' : undefined}>
              <ProjectCard project={p} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
