import { Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SourceDto } from '../lib/types';
import { TimeAgo } from './TimeAgo';

function statusFor(source: SourceDto): { dot: string; label: string } {
  if (source.lastError) return { dot: 'bg-red-400', label: 'Degraded' };
  if (source.lastSuccessAt == null) return { dot: 'bg-mist-500', label: 'Waiting' };
  return { dot: 'bg-emerald-400', label: 'Healthy' };
}

export function SourceHealth({ sources }: { sources: SourceDto[] }) {
  const newsSources = sources.filter((source) => source.cadence === 'news');
  return (
    <section className="rounded-xl border border-ink-700/70 bg-ink-850/50">
      <div className="flex items-center justify-between border-b border-ink-700/60 px-3.5 py-2.5">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mist-300">
          <Radio className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          Source health
        </h2>
        <Link to="/sources" className="text-[10px] text-proton-400 transition hover:text-proton-300">
          Details
        </Link>
      </div>
      <ul className="divide-y divide-ink-800/70">
        {newsSources.map((source) => {
          const status = statusFor(source);
          return (
            <li key={source.id} className="flex items-center gap-2 px-3.5 py-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                title={status.label}
                aria-hidden="true"
              />
              <span className="sr-only">{status.label}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-mist-300">
                {source.name}
              </span>
              <span className="text-[10px] text-mist-500">
                {source.lastSuccessAt ? <TimeAgo epoch={source.lastSuccessAt} /> : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
