'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Github, Loader2, Plug, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, GitConnection } from '@/lib/api';

const fetcher = () => authApi.gitConnections().then((r) => r.data);

export default function GitPage() {
  const { data: connections, mutate } = useSWR<GitConnection[]>('/auth/git-connections', fetcher);
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    setConnecting(true);
    try {
      const { data } = await authApi.startGithubOAuth();
      if (!data.configured || !data.authorizationUrl) {
        toast.error('GitHub OAuth is not configured on the API');
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch {
      toast.error('Could not start GitHub connection');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect GitHub from this account?')) return;
    try {
      await authApi.disconnectGithub();
      toast.success('GitHub disconnected');
      mutate();
    } catch {
      toast.error('Could not disconnect GitHub');
    }
  }

  const github = connections?.find((connection) => connection.provider === 'github');

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Git</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Connect source providers used by your services and builds.
        </p>
      </div>

      <div className="grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-white">GitHub</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">OAuth connection</p>
              </div>
            </div>
          </div>

          {github ? (
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-3">
                {github.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={github.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                    <Github className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-950 dark:text-white">{github.username}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Connected</div>
                </div>
              </div>
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <div className="p-5">
              <button
                type="button"
                onClick={connect}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Connect GitHub
              </button>
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <h2 className="mb-2 font-semibold text-slate-950 dark:text-white">How it works</h2>
          <p>
            You will be sent to GitHub to authorize this platform. After GitHub redirects back, the API stores the access
            token encrypted in the database and services can use it for private repository builds.
          </p>
        </aside>
      </div>
    </div>
  );
}
