'use client';
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { streamContainerLogs } from '@/lib/websocket';

interface LogLine {
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
}

interface Props {
  deploymentId: string;
  autoFollow?: boolean;
}

export default function LogViewer({ deploymentId, autoFollow = true }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoFollow) return;

    setStreaming(true);
    setLines([]);

    const cancel = streamContainerLogs(
      deploymentId,
      (line, stream) => {
        setLines((prev) => [
          ...prev.slice(-500),
          { line, stream: stream as 'stdout' | 'stderr', timestamp: new Date().toISOString() },
        ]);
      },
      200,
    );

    return () => {
      cancel();
      setStreaming(false);
    };
  }, [deploymentId, autoFollow]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2">
        <span className="font-mono text-xs text-slate-400">
          {streaming ? 'streaming' : 'static'} - {lines.length} lines
        </span>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={clsx(
            'rounded px-2 py-0.5 text-xs transition-colors',
            autoScroll ? 'bg-brand-500/15 text-brand-300' : 'text-slate-500 hover:text-slate-300',
          )}
        >
          {autoScroll ? 'auto-scroll on' : 'auto-scroll off'}
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-72 space-y-0.5 overflow-y-auto bg-slate-950 p-4 font-mono text-xs"
      >
        {lines.length === 0 && (
          <span className="text-slate-600">Waiting for logs...</span>
        )}
        {lines.map((l, i) => (
          <div key={i} className="flex gap-3 leading-5">
            <span className="shrink-0 select-none text-slate-600">
              {new Date(l.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={clsx(
                'whitespace-pre-wrap break-all',
                l.stream === 'stderr' ? 'text-rose-300' : 'text-slate-300',
              )}
            >
              {l.line}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
