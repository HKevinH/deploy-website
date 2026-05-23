'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { clsx } from 'clsx';
import { Download, Loader2 } from 'lucide-react';
import { Build, buildsApi } from '@/lib/api';
import { subscribeToBuildLogs } from '@/lib/websocket';
import { useI18n } from '@/lib/i18n';
import StatusBadge from './DeploymentStatus';

interface LogLine {
  line: string;
  timestamp: string;
}

interface Props {
  serviceId: string;
}

const LIVE_STATUSES = new Set(['pending', 'building']);

export default function BuildLogsPanel({ serviceId }: Props) {
  const { t } = useI18n();
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: builds, mutate } = useSWR<Build[]>(
    `builds:${serviceId}`,
    () => buildsApi.list(serviceId).then((r) => r.data),
    { refreshInterval: 4000 },
  );

  const selectedBuild = useMemo(
    () => builds?.find((build) => build.id === selectedBuildId) ?? builds?.[0] ?? null,
    [builds, selectedBuildId],
  );

  useEffect(() => {
    if (!selectedBuildId && builds?.[0]) setSelectedBuildId(builds[0].id);
  }, [builds, selectedBuildId]);

  useEffect(() => {
    if (!selectedBuild) return;

    let cancelled = false;
    setLoadingLogs(true);
    setDownloadUrl(null);
    setLines([]);

    buildsApi.logs(serviceId, selectedBuild.id)
      .then((res) => {
        if (cancelled) return;
        const parsed = res.data.content
          .split('\n')
          .filter(Boolean)
          .map(parseStoredLine);
        setLines((prev) => mergeLogLines(parsed, prev));
      })
      .catch(() => {
        if (!cancelled) setLines((prev) => prev);
      })
      .finally(() => {
        if (!cancelled) setLoadingLogs(false);
      });

    buildsApi.downloadLogs(serviceId, selectedBuild.id)
      .then((res) => {
        if (!cancelled) setDownloadUrl(res.data.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setDownloadUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, selectedBuild?.id, selectedBuild?.logPath]);

  useEffect(() => {
    if (!selectedBuild || !LIVE_STATUSES.has(selectedBuild.status)) return;

    const cancel = subscribeToBuildLogs(
      selectedBuild.id,
      (line, timestamp) => {
        setLines((prev) => [...prev, { line, timestamp }].slice(-800));
      },
      () => mutate(),
    );

    return cancel;
  }, [mutate, selectedBuild?.id, selectedBuild?.status]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, autoScroll]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }

  if (!builds) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('loadingBuilds')}
      </div>
    );
  }

  if (builds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {t('noBuilds')}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="px-2 pb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{t('buildHistory')}</div>
        <div className="space-y-1">
          {builds.map((build) => (
            <button
              key={build.id}
              onClick={() => setSelectedBuildId(build.id)}
              className={clsx(
                'block w-full rounded-md p-3 text-left transition-colors',
                selectedBuild?.id === build.id
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-slate-950 dark:text-white">{build.commitSha.slice(0, 7)}</span>
                <StatusBadge status={build.status} />
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {build.commitMessage || new Date(build.createdAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{t('buildLogs')}</h2>
              {selectedBuild && <StatusBadge status={selectedBuild.status} />}
            </div>
            {selectedBuild?.errorMessage && (
              <p className="mt-1 truncate text-xs text-rose-500 dark:text-rose-300">{selectedBuild.errorMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                title={t('downloadLogs')}
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={clsx(
                'rounded px-2 py-1 text-xs transition-colors',
                autoScroll ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {autoScroll ? t('autoScrollOn') : t('autoScrollOff')}
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-[28rem] overflow-y-auto bg-slate-950 p-4 font-mono text-xs"
        >
          {loadingLogs && <div className="text-slate-500">{t('loadingLogs')}</div>}
          {!loadingLogs && lines.length === 0 && <div className="text-slate-500">{t('waitingForBuildLogs')}</div>}
          {lines.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="flex gap-3 leading-5">
              <span className="shrink-0 select-none text-slate-600">{formatTime(entry.timestamp)}</span>
              <span className="whitespace-pre-wrap break-all text-slate-300">{entry.line}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

function parseStoredLine(raw: string): LogLine {
  const match = raw.match(/^\[([^\]]+)\]\s?(.*)$/);
  if (!match) return { timestamp: new Date().toISOString(), line: raw };
  return { timestamp: match[1], line: match[2] };
}

function mergeLogLines(...groups: LogLine[][]): LogLine[] {
  const seen = new Set<string>();
  const merged: LogLine[] = [];

  for (const entry of groups.flat()) {
    const key = `${entry.timestamp}:${entry.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged.slice(-800);
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString();
}
