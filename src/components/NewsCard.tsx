import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import type { NewsItemDto } from '../lib/types';
import { CategoryBadge, CategoryBadges, SourceBadge } from './Badges';
import { GameChips } from './GameChip';
import { TimeAgo } from './TimeAgo';
import { CATEGORY_META } from '../lib/constants';

export function NewsCard({
  item,
  isNew,
  onOpen,
}: {
  item: NewsItemDto;
  isNew: boolean;
  onOpen: (id: string) => void;
}) {
  const previewEntries = item.entries.slice(0, 3);

  return (
    <article className="group relative rounded-xl border border-ink-700/70 bg-ink-850/60 p-4 transition hover:border-ink-600 hover:bg-ink-850">
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge sourceId={item.sourceId} name={item.sourceName} />
        {item.version && (
          <span className="rounded-md border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-mist-400">
            {item.version}
          </span>
        )}
        <CategoryBadges categories={item.categories} flags={item.flags} max={3} />
        {isNew && (
          <span className="inline-flex items-center gap-1 rounded-md border border-proton-500/30 bg-proton-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-proton-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            New
          </span>
        )}
        <span className="ml-auto text-[10px] text-mist-500">
          <TimeAgo epoch={item.publishedAt ?? item.discoveredAt} />
        </span>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold leading-snug text-mist-100">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-proton-300"
        >
          {item.title}
        </a>
      </h3>

      {item.summary && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mist-400">{item.summary}</p>
      )}

      {previewEntries.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-ink-700/60 bg-ink-900/50 p-2.5">
          {previewEntries.map((entry) => (
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
          {item.entryCount > previewEntries.length && (
            <p className="pl-6 text-[10px] text-mist-500">
              +{item.entryCount - previewEntries.length} more{' '}
              {item.entryCount - previewEntries.length === 1 ? 'change' : 'changes'}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GameChips games={item.games} max={4} />
        <span className="text-[10px] text-mist-500">
          {item.entryCount > 0
            ? `${item.entryCount} ${item.entryCount === 1 ? 'change' : 'changes'}`
            : CATEGORY_META[item.categories[0] ?? 'other'].label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[10px] font-medium text-mist-300 transition hover:border-proton-500/50 hover:text-proton-300"
          >
            Details
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-mist-500 transition hover:text-mist-200"
            aria-label={`Open original source for ${item.title}`}
          >
            Source
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}
