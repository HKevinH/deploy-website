'use client';
import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, GitBranch, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, GitConnection, GithubRepository, RepoDetection, servicesApi } from '@/lib/api';

const gitConnectionsFetcher = () => authApi.gitConnections().then((r) => r.data);
const githubRepositoriesFetcher = () => authApi.githubRepositories().then((r) => r.data);

export default function NewServicePage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitMode, setGitMode] = useState<'connected' | 'manual'>('connected');
  const [port, setPort] = useState(3000);
  const [dockerfilePath, setDockerfilePath] = useState('Dockerfile');
  const [dockerContext, setDockerContext] = useState('.');
  const [gitConnectionId, setGitConnectionId] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [detection, setDetection] = useState<RepoDetection | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: gitConnections } = useSWR<GitConnection[]>('/auth/git-connections', gitConnectionsFetcher);
  const { data: githubRepositories, isLoading: loadingRepos } = useSWR<GithubRepository[]>(
    gitMode === 'connected' && gitConnectionId === 'github' ? '/auth/git-connections/github/repos' : null,
    githubRepositoriesFetcher,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const { data } = await servicesApi.create(projectId, {
        name,
        gitUrl: gitUrl || undefined,
        gitBranch: gitBranch || 'main',
        gitProvider: gitMode === 'connected' && gitConnectionId === 'github' ? 'github' : undefined,
        port,
        dockerfilePath: dockerfilePath || 'Dockerfile',
        dockerContext: dockerContext || '.',
        autoDeploy,
      });

      toast.success('Service created');
      router.push(`/projects/${projectId}/services/${data.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create service');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/projects" className="hover:text-slate-950 dark:hover:text-white">Projects</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/projects/${projectId}`} className="hover:text-slate-950 dark:hover:text-white">Project</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-950 dark:text-white">New service</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Add Service</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Connect a repository and define the runtime defaults.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Service name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="input"
              placeholder="web"
            />
          </Field>

          <Field label="Branch">
            <div className="relative">
              <GitBranch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
                className="input pl-9"
                placeholder="main"
              />
            </div>
          </Field>

          <div className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Git source</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SourceOption
                checked={gitMode === 'connected'}
                title="Connected account"
                description="Pick a GitHub account and repository."
                onChange={() => {
                  setGitMode('connected');
                  setGitUrl('');
                }}
              />
              <SourceOption
                checked={gitMode === 'manual'}
                title="Manual URL"
                description="Paste a public or accessible Git URL."
                onChange={() => {
                  setGitMode('manual');
                  setGitConnectionId('');
                  setSelectedRepo('');
                }}
              />
            </div>
          </div>

          {gitMode === 'connected' ? (
            <Field label="Git account" className="md:col-span-2">
              <select
                value={gitConnectionId}
                onChange={(e) => {
                  setGitConnectionId(e.target.value);
                  setSelectedRepo('');
                  setGitUrl('');
                }}
                className="input"
              >
                <option value="">Select connected account</option>
                {gitConnections?.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.provider} - {connection.username}
                  </option>
                ))}
              </select>
              {gitConnections?.length === 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Connect GitHub first in <Link href="/git" className="font-medium text-brand-600 dark:text-brand-400">Git settings</Link>.
                </p>
              )}
            </Field>
          ) : (
            <Field label="Git URL" className="md:col-span-2">
              <input
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                type="url"
                className="input"
                placeholder="https://github.com/user/repo.git"
              />
            </Field>
          )}

          {gitMode === 'connected' && gitConnectionId === 'github' && (
            <Field label="Repository" className="md:col-span-2">
              <select
                value={selectedRepo}
                onChange={(e) => {
                  const value = e.target.value;
                  const repo = githubRepositories?.find((item) => String(item.id) === value);

                  setSelectedRepo(value);
                  if (!repo) return;

                  setGitUrl(repo.cloneUrl);
                  setGitBranch(repo.defaultBranch);
                  setName((current) => current || repo.fullName.split('/')[1] || repo.fullName);
                  setDetection(null);
                  setDetecting(true);
                  authApi.detectGithubRepository(repo.fullName)
                    .then(({ data }) => {
                      setDetection(data);
                      setDockerfilePath(data.dockerfilePath);
                      setDockerContext(data.dockerContext);
                      setPort(data.port);
                    })
                    .catch(() => toast.error('Could not detect build settings'))
                    .finally(() => setDetecting(false));
                }}
                className="input"
                disabled={loadingRepos}
                required
              >
                <option value="">{loadingRepos ? 'Loading repositories...' : 'Select repository'}</option>
                {githubRepositories?.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.fullName}{repo.private ? ' (private)' : ''}
                  </option>
                ))}
              </select>
              {githubRepositories?.length === 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  No repositories were returned by GitHub. Check the app permissions.
                </p>
              )}
            </Field>
          )}

          {(detecting || detection) && (
            <div className="md:col-span-2 rounded-lg border border-brand-500/20 bg-brand-50 p-4 dark:border-brand-700/40 dark:bg-brand-950/25">
              <div className="text-sm font-semibold text-brand-800 dark:text-brand-100">
                {detecting ? 'Detecting build preset...' : detection?.label}
              </div>
              {detection && (
                <div className="mt-2 text-xs text-brand-800/80 dark:text-brand-100/75">
                  {detection.notes.join(' ')} Dockerfile: {detection.dockerfilePath}, context: {detection.dockerContext}, port: {detection.port}.
                </div>
              )}
            </div>
          )}

          <Field label="Dockerfile path">
            <input
              value={dockerfilePath}
              onChange={(e) => setDockerfilePath(e.target.value)}
              className="input"
              placeholder="Dockerfile"
            />
          </Field>

          <Field label="Docker context">
            <input
              value={dockerContext}
              onChange={(e) => setDockerContext(e.target.value)}
              className="input"
              placeholder="."
            />
          </Field>

          <Field label="Container port">
            <input
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              type="number"
              min={1}
              max={65535}
              className="input"
            />
          </Field>
        </div>

        <label className="mt-5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">Auto deploy</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Deploy automatically after a successful build.
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoDeploy}
            onChange={(e) => setAutoDeploy(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create service
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function SourceOption({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
        checked
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-100'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-brand-600"
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs opacity-75">{description}</span>
      </span>
    </label>
  );
}
