import { ArrowUpRight, ChevronRight } from 'lucide-react';
import type { NewsItemDto } from '../lib/types';
import { CategoryBadge, CategoryBadges, SourceBadge } from './Badges';
import { GameChips } from './GameChip';
import { TimeAgo } from './TimeAgo';
import { formatDate } from '../lib/format';

export function ReleaseCard({
  item,
  featured = false,
  onOpen,
}: {
  item: NewsItemDto;
  featured?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-xl border bg-ink-850/60 transition hover:border-ink-600 hover:bg-ink-850 ${
        featured
          ? 'border-proton-500/20 p-5 shadow-[0_0_40px_-24px_rgba(56,189,248,0.5)]'
          : 'border-ink-700/70 p-4'
      }`}
    >
      {featured && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-proton-400/50 to-transparent" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge sourceId={item.sourceId} name={item.sourceName} />
        {item.version && (
          <span className="rounded-md border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-mist-400">
            {item.version}
          </span>
        )}
        <span className="ml-auto text-[10px] text-mist-500">
          <TimeAgo epoch={item.publishedAt ?? item.discoveredAt} />
        </span>
      </div>

      <h3
        className={`mt-2 font-semibold leading-snug text-mist-100 ${
          featured ? 'text-lg' : 'text-sm'
        }`}
      >
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-proton-300">
          {item.title}
        </a>
      </h3>
      <p className="mt-0.5 text-[10px] text-mist-500">{formatDate(item.publishedAt)}</p>

      <div className="mt-2">
        <CategoryBadges categories={item.categories} flags={item.flags} max={featured ? 4 : 3} />
      </div>

      {item.summary && (
        <p
          className={`mt-2 leading-relaxed text-mist-400 ${
            featured ? 'line-clamp-3 text-xs' : 'line-clamp-2 text-[11px]'
          }`}
        >
          {item.summary}
        </p>
      )}

      {featured && item.entries.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-ink-700/60 bg-ink-900/50 p-2.5">
          {item.entries.slice(0, 3).map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <CategoryBadge category={entry.category} compact />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[11px] leading-relaxed text-mist-300">
                  {entry.text}
                </p>
                {entry.games.length > 0 && (
                  <div className="mt-1">
                    <GameChips games={entry.games} max={3} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-mist-500">
          {item.entryCount} {item.entryCount === 1 ? 'change' : 'changes'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[10px] font-medium text-mist-300 transition hover:border-proton-500/50 hover:text-proton-300"
          >
            Read notes
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-1 text-mist-500 transition hover:text-mist-200"
            aria-label={`Open original release notes for ${item.title}`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}
