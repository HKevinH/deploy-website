'use client';
import { FormEvent, useRef, useState } from 'react';
import { Loader2, Play, Terminal } from 'lucide-react';
import { deploymentsApi } from '@/lib/api';
import { clsx } from 'clsx';

interface TerminalEntry {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

interface Props {
  serviceId: string;
  deploymentId: string | null;
}

export default function ExecTerminal({ serviceId, deploymentId }: Props) {
  const [command, setCommand] = useState('pwd && ls -la');
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const idRef = useRef(0);

  async function runCommand(e: FormEvent) {
    e.preventDefault();
    if (!deploymentId || !command.trim() || running) return;

    const current = command.trim();
    setRunning(true);

    try {
      const { data } = await deploymentsApi.exec(serviceId, deploymentId, current);
      setEntries((prev) => [
        ...prev,
        { id: ++idRef.current, command: current, ...data },
      ]);
    } catch (err: any) {
      setEntries((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          command: current,
          stdout: '',
          stderr: err?.response?.data?.message ?? 'Command failed',
          exitCode: 1,
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Container exec</h2>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {deploymentId ? `deployment ${deploymentId.slice(0, 8)}` : 'no active container'}
        </span>
      </div>

      <div className="h-80 overflow-y-auto bg-slate-950 p-4 font-mono text-xs text-slate-200">
        {entries.length === 0 && (
          <div className="text-slate-500">Run a command against the active deployment container.</div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-emerald-300">
              <span>$</span>
              <span className="break-all">{entry.command}</span>
            </div>
            {entry.stdout && <pre className="whitespace-pre-wrap break-words text-slate-200">{entry.stdout}</pre>}
            {entry.stderr && <pre className="whitespace-pre-wrap break-words text-rose-300">{entry.stderr}</pre>}
            <div
              className={clsx(
                'mt-2 text-[11px]',
                entry.exitCode === 0 ? 'text-emerald-400' : 'text-amber-300',
              )}
            >
              exit {entry.exitCode ?? 'unknown'}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={runCommand} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={!deploymentId || running}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="sh command"
        />
        <button
          type="submit"
          disabled={!deploymentId || running || !command.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run
        </button>
      </form>
    </section>
  );
}
