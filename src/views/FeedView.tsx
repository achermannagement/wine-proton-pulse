import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Bug,
  ChevronDown,
  Gamepad2,
  Inbox,
  Newspaper,
  SlidersHorizontal,
} from 'lucide-react';
import type { FeedCounts, NewsItemDto } from '../lib/types';
import { fetchFeed } from '../lib/api';
import { FEED_TABS } from '../lib/constants';
import { formatDayLabel } from '../lib/format';
import { useDashboard } from '../hooks/useDashboard';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePageTitle } from '../hooks/usePageTitle';
import { FeedFilters } from '../components/FeedFilters';
import { NewsCard } from '../components/NewsCard';
import { ItemDrawer } from '../components/ItemDrawer';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState, SkeletonCard } from '../components/States';
import { CompatibilityPulse } from '../components/CompatibilityPulse';
import { SourceHealth } from '../components/SourceHealth';
import { ReleaseCard } from '../components/ReleaseCard';
import { TimeAgo } from '../components/TimeAgo';

const EMPTY_COUNTS: FeedCounts = {
  all: 0,
  features: 0,
  gamefixes: 0,
  bugfixes: 0,
  compat: 0,
  releases: 0,
  discussions: 0,
};

export function FeedView() {
  usePageTitle('Feed');
  const [params, setParams] = useSearchParams();
  const { stats, version, lastVisit, showToast } = useDashboard();
  const category = params.get('category') ?? 'all';
  const source = params.get('source');
  const range = params.get('range') ?? 'all';
  const q = params.get('q') ?? '';
  const itemId = params.get('item');

  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const firstParamSync = useRef(true);
  const [items, setItems] = useState<NewsItemDto[]>([]);
  const [counts, setCounts] = useState<FeedCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (firstParamSync.current) {
      firstParamSync.current = false;
      return;
    }
    setSearchInput(q);
  }, [q]);

  const previousDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch === previousDebouncedSearch.current) return;
    previousDebouncedSearch.current = debouncedSearch;
    if (debouncedSearch === q) return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (debouncedSearch) next.set('q', debouncedSearch);
        else next.delete('q');
        next.delete('item');
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, q, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchFeed(
      {
        category: category === 'all' ? undefined : category,
        source,
        range,
        q: q || null,
        limit: 30,
        offset: 0,
      },
      controller.signal,
    )
      .then((response) => {
        setItems(response.items);
        setTotal(response.total);
        setCounts(response.counts);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Unable to load the feed');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, source, range, q, version, reloadNonce]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== 'item') next.delete('item');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const resetFilters = () => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchFeed({
        category: category === 'all' ? undefined : category,
        source,
        range,
        q: q || null,
        limit: 30,
        offset: items.length,
      });
      setItems((previous) => [...previous, ...response.items]);
      setTotal(response.total);
      setCounts(response.counts);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Unable to load more', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => {
    const grouped = new Map<string, NewsItemDto[]>();
    for (const item of items) {
      const epoch = item.publishedAt ?? item.discoveredAt;
      const key = formatDayLabel(epoch);
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }
    return [...grouped.entries()];
  }, [items]);

  const filters = (
    <FeedFilters
      counts={counts}
      sources={stats?.sources ?? []}
      category={category}
      source={source}
      range={range}
      search={searchInput}
      onCategory={(value) => updateParam('category', value === 'all' ? null : value)}
      onSource={(value) => updateParam('source', value)}
      onRange={(value) => updateParam('range', value === 'all' ? null : value)}
      onSearch={setSearchInput}
      onReset={resetFilters}
    />
  );

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[215px_minmax(0,1fr)] xl:grid-cols-[215px_minmax(0,1fr)_300px]">
        <aside className="hidden lg:block">
          <div className="sticky top-[92px] max-h-[calc(100vh-110px)] overflow-y-auto pr-1">{filters}</div>
        </aside>

        <div className="min-w-0">
          <section className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-proton-400">
              Wine &amp; Proton news
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">
              The pulse of Linux gaming compatibility
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist-400">
              Official Wine, Proton, GE-Proton, DXVK and VKD3D changelogs, plus Linux gaming
              coverage. Game fixes, newly playable titles and compatibility changes are pulled
              out automatically.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                label="Stories"
                value={counts.all}
                hint="in the current index"
                icon={<Newspaper className="h-4 w-4" />}
              />
              <StatCard
                label="Game fixes"
                value={counts.gamefixes}
                hint="bug fixes with game context"
                icon={<Bug className="h-4 w-4" />}
                tone="text-amber-200"
              />
              <StatCard
                label="Games tracked"
                value={stats?.counts.games ?? '—'}
                hint="ProtonDB snapshots"
                icon={<Gamepad2 className="h-4 w-4" />}
                tone="text-proton-200"
              />
              <StatCard
                label="Tier changes"
                value={stats?.counts.compatEvents ?? 0}
                hint="recorded compatibility shifts"
                icon={<Activity className="h-4 w-4" />}
                tone="text-emerald-200"
              />
            </div>
          </section>

          <details className="mb-4 rounded-xl border border-ink-700/70 bg-ink-850/60 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-mist-300">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filters
              <ChevronDown className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
            </summary>
            <div className="border-t border-ink-700/60 px-3.5 py-3">{filters}</div>
          </details>

          <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl border border-ink-700/70 bg-ink-850/60 p-1" data-testid="feed-tabs">
            {FEED_TABS.map((tab) => {
              const active = category === tab.key;
              const count =
                tab.key === 'feature'
                  ? counts.features
                  : tab.key === 'gamefix'
                    ? counts.gamefixes
                    : tab.key === 'bugfix'
                      ? counts.bugfixes
                      : tab.key === 'compat'
                        ? counts.compat
                        : tab.key === 'release'
                          ? counts.releases
                          : tab.key === 'discussion'
                            ? counts.discussions
                            : counts.all;
              return (
                <button
                  key={tab.key}
                  type="button"
                  data-testid={`feed-tab-${tab.key}`}
                  onClick={() => updateParam('category', tab.key === 'all' ? null : tab.key)}
                  aria-pressed={active}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-ink-750 text-mist-100 shadow-sm'
                      : 'text-mist-400 hover:bg-ink-800 hover:text-mist-200'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] ${active ? 'text-proton-300' : 'text-mist-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-2 flex items-center justify-between text-[10px] text-mist-500">
            <span>
              {total} {total === 1 ? 'story' : 'stories'}
              {q ? ` matching “${q}”` : ''}
            </span>
            {stats?.lastUpdated && (
              <span>
                Index updated <TimeAgo epoch={stats.lastUpdated} />
              </span>
            )}
          </div>

          {loading && items.length === 0 && (
            <div className="space-y-3" aria-busy="true">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {error && items.length === 0 && (
            <ErrorState message={error} onRetry={() => setReloadNonce((value) => value + 1)} />
          )}

          {!loading && !error && items.length === 0 && (
            <EmptyState
              title="No stories match these filters"
              description="Try a wider time range, a different source, or clear the search. New items appear after the next refresh."
              icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-200 hover:text-white"
                >
                  Reset filters
                </button>
              }
            />
          )}

          {groups.length > 0 && (
            <div className="space-y-5">
              {groups.map(([label, groupItems]) => (
                <section key={label}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-mist-500">
                      {label}
                    </h2>
                    <div className="h-px flex-1 bg-ink-800" />
                  </div>
                  <div className="space-y-2.5">
                    {groupItems.map((item) => (
                      <NewsCard
                        key={item.id}
                        item={item}
                        isNew={lastVisit > 0 && item.discoveredAt > lastVisit}
                        onOpen={(id) => updateParam('item', id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {items.length < total && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-xs font-medium text-mist-200 transition hover:border-proton-500/50 hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : `Load ${Math.min(30, total - items.length)} more`}
              </button>
            </div>
          )}
        </div>

        <aside className="hidden space-y-3 xl:block">
          <div className="sticky top-[92px] max-h-[calc(100vh-110px)] space-y-3 overflow-y-auto pr-1">
            <CompatibilityPulse events={stats?.pulse ?? []} />
            <section className="rounded-xl border border-ink-700/70 bg-ink-850/50">
              <div className="border-b border-ink-700/60 px-3.5 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-mist-300">
                  Latest releases
                </h2>
              </div>
              <div className="space-y-2 p-2.5">
                {(stats?.latestReleases ?? []).slice(0, 5).map((item) => (
                  <ReleaseCard
                    key={item.id}
                    item={item}
                    onOpen={(id) => updateParam('item', id)}
                  />
                ))}
                {!stats?.latestReleases?.length && (
                  <p className="px-1 py-2 text-[11px] text-mist-500">
                    Releases appear after the first sync.
                  </p>
                )}
              </div>
            </section>
            <SourceHealth sources={stats?.sources ?? []} />
          </div>
        </aside>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:hidden">
        <CompatibilityPulse events={stats?.pulse ?? []} />
        <SourceHealth sources={stats?.sources ?? []} />
      </div>

      <ItemDrawer itemId={itemId} onClose={() => updateParam('item', null)} />
    </>
  );
}
