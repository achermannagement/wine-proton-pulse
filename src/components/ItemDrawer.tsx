import { ArrowUpRight, Copy, ExternalLink } from 'lucide-react';
import type { NewsEntryDto, NewsItemDto } from '../lib/types';
import { fetchItem } from '../lib/api';
import { formatDate } from '../lib/format';
import { CATEGORY_META } from '../lib/constants';
import { useResource } from '../hooks/useResource';
import { useDashboard } from '../hooks/useDashboard';
import { Drawer } from './Drawer';
import { CategoryBadge, CategoryBadges, SourceBadge } from './Badges';
import { GameChips } from './GameChip';
import { ErrorState, SkeletonLine } from './States';

function groupEntries(entries: NewsEntryDto[]): [string, NewsEntryDto[]][] {
  const groups = new Map<string, NewsEntryDto[]>();
  for (const entry of entries) {
    const key = entry.section ?? CATEGORY_META[entry.category].label;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function ItemDrawer({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const { showToast } = useDashboard();
  const { data, loading, error, reload } = useResource<NewsItemDto>(
    `item:${itemId ?? 'none'}`,
    (signal) => fetchItem(itemId ?? '', signal),
    { enabled: Boolean(itemId), resetOnKey: true },
  );

  if (!itemId) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard.', 'success');
    } catch {
      showToast('Could not copy the link.', 'error');
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={data?.title ?? 'Loading item…'}
      subtitle={
        data ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <SourceBadge sourceId={data.sourceId} name={data.sourceName} />
            {data.version && <span className="font-mono">{data.version}</span>}
            <span aria-hidden="true">·</span>
            <span>{formatDate(data.publishedAt ?? data.discoveredAt)}</span>
          </span>
        ) : null
      }
      footer={
        data ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-proton-500/30 bg-proton-500/10 px-3 py-1.5 text-xs font-medium text-proton-200 transition hover:border-proton-400/60 hover:text-white"
            >
              Open original
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-300 transition hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy link
            </button>
          </div>
        ) : null
      }
    >
      {loading && !data && (
        <div className="space-y-3">
          <SkeletonLine className="h-5 w-2/3" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-5/6" />
          <SkeletonLine className="h-20 w-full" />
        </div>
      )}

      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadges categories={data.categories} flags={data.flags} max={5} />
            <span className="text-[10px] text-mist-500">
              {data.entryCount} parsed {data.entryCount === 1 ? 'change' : 'changes'}
            </span>
          </div>

          {data.summary && (
            <div className="rounded-xl border border-ink-700/70 bg-ink-850/60 p-3.5">
              <p className="text-sm leading-relaxed text-mist-300">{data.summary}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <GameChips games={data.games} max={10} />
          </div>

          {data.entries.length === 0 ? (
            <p className="rounded-xl border border-ink-700/70 bg-ink-850/40 p-4 text-xs leading-relaxed text-mist-500">
              This item has no parsed changelog. Open the original source for the full story.
            </p>
          ) : (
            groupEntries(data.entries).map(([section, entries]) => (
              <section key={section}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mist-400">
                  <span>{section}</span>
                  <span className="rounded-full border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-[9px] font-normal tracking-normal text-mist-500">
                    {entries.length}
                  </span>
                </h3>
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <CategoryBadge category={entry.category} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-relaxed text-mist-300">{entry.text}</p>
                          {entry.games.length > 0 && (
                            <div className="mt-2">
                              <GameChips games={entry.games} max={6} />
                            </div>
                          )}
                          {entry.externalUrl && entry.externalUrl !== data.url && (
                            <a
                              href={entry.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[10px] text-proton-400 transition hover:text-proton-300"
                            >
                              Reference
                              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
    </Drawer>
  );
}
