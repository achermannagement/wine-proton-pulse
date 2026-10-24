import { useId } from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import type { FeedCounts, SourceDto } from '../lib/types';
import { FEED_TABS, RANGE_OPTIONS } from '../lib/constants';

function countFor(tab: string, counts: FeedCounts): number {
  switch (tab) {
    case 'feature':
      return counts.features;
    case 'gamefix':
      return counts.gamefixes;
    case 'bugfix':
      return counts.bugfixes;
    case 'compat':
      return counts.compat;
    case 'release':
      return counts.releases;
    case 'discussion':
      return counts.discussions;
    default:
      return counts.all;
  }
}

function sourceDot(source: SourceDto): string {
  if (source.lastError) return 'bg-red-400';
  if (source.lastSuccessAt == null) return 'bg-mist-500';
  return 'bg-emerald-400';
}

export function FeedFilters({
  counts,
  sources,
  category,
  source,
  range,
  search,
  onCategory,
  onSource,
  onRange,
  onSearch,
  onReset,
}: {
  counts: FeedCounts;
  sources: SourceDto[];
  category: string;
  source: string | null;
  range: string;
  search: string;
  onCategory: (value: string) => void;
  onSource: (value: string | null) => void;
  onRange: (value: string) => void;
  onSearch: (value: string) => void;
  onReset: () => void;
}) {
  const searchId = useId();
  const newsSources = sources.filter((candidate) => candidate.cadence === 'news');
  const hasFilters = category !== 'all' || source != null || range !== 'all' || search.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={searchId} className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mist-500">
          Search the pulse
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search titles…"
            className="w-full rounded-lg border border-ink-600 bg-ink-850 py-2 pl-8 pr-8 text-xs text-mist-200 placeholder:text-mist-500 focus:border-proton-500/60 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-mist-500 hover:text-mist-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-500">
          Categories
        </h3>
        <div className="space-y-0.5">
          {FEED_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onCategory(tab.key)}
              aria-pressed={category === tab.key}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition ${
                category === tab.key
                  ? 'bg-ink-800 text-mist-100'
                  : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="tabular-nums text-[10px] text-mist-500">
                {countFor(tab.key, counts)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-500">
          Time range
        </h3>
        <div className="flex flex-wrap gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onRange(option.key)}
              aria-pressed={range === option.key}
              className={`rounded-md border px-2 py-1 text-[10px] transition ${
                range === option.key
                  ? 'border-proton-500/40 bg-proton-500/10 text-proton-200'
                  : 'border-ink-600 bg-ink-850 text-mist-400 hover:text-mist-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-mist-500">
          Sources
        </h3>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSource(null)}
            aria-pressed={source == null}
            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition ${
              source == null
                ? 'bg-ink-800 text-mist-100'
                : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200'
            }`}
          >
            <span>All sources</span>
            <span className="tabular-nums text-[10px] text-mist-500">
              {newsSources.reduce((sum, item) => sum + item.itemCount, 0)}
            </span>
          </button>
          {newsSources.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSource(source === item.id ? null : item.id)}
              aria-pressed={source === item.id}
              title={item.lastError ?? `${item.itemCount} items`}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                source === item.id
                  ? 'bg-ink-800 text-mist-100'
                  : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sourceDot(item)}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="tabular-nums text-[10px] text-mist-500">{item.itemCount}</span>
            </button>
          ))}
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-[10px] text-mist-300 transition hover:text-white"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset filters
        </button>
      )}
    </div>
  );
}
