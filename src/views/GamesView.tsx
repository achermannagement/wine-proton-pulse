import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Gamepad2,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';
import type { GameSearchResponse, GamesResponse } from '../lib/types';
import { fetchGames, searchGames } from '../lib/api';
import { GAME_SORTS, TIER_META } from '../lib/constants';
import { useDashboard } from '../hooks/useDashboard';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { GameCard, GameCardSkeleton } from '../components/GameCard';
import { GameDrawer } from '../components/GameDrawer';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/States';

const TIER_OPTIONS = ['all', 'platinum', 'gold', 'silver', 'bronze', 'borked', 'pending'] as const;

export function GamesView() {
  usePageTitle('Games');
  const [params, setParams] = useSearchParams();
  const { stats, version, watchlist, toggleWatch, isWatched, showToast } = useDashboard();

  const qParam = params.get('q') ?? '';
  const tier = params.get('tier') ?? 'all';
  const sort = params.get('sort') ?? 'recent';
  const watchMode = params.get('watch') === '1';
  const gameParam = params.get('game');
  const featured = !watchMode && !qParam && params.get('featured') !== '0';

  const [searchInput, setSearchInput] = useState(qParam);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const firstParamSync = useRef(true);

  useEffect(() => {
    if (firstParamSync.current) {
      firstParamSync.current = false;
      return;
    }
    setSearchInput(qParam);
  }, [qParam]);

  const previousDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch === previousDebouncedSearch.current) return;
    previousDebouncedSearch.current = debouncedSearch;
    if (debouncedSearch === qParam) return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (debouncedSearch) next.set('q', debouncedSearch);
        else next.delete('q');
        next.delete('game');
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, qParam, setParams]);

  useEffect(() => {
    if (submittedQuery && searchInput.trim() !== submittedQuery) setSubmittedQuery(null);
  }, [searchInput, submittedQuery]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== 'game') next.delete('game');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const games = useResource<GamesResponse>(
    `games:${qParam}:${tier}:${sort}:${featured}:${watchMode}:${watchlist.join(',')}:${version}`,
    (signal) =>
      fetchGames(
        {
          q: qParam || null,
          tier: tier === 'all' ? null : tier,
          sort,
          featured,
          appids: watchMode ? watchlist : undefined,
          limit: 100,
        },
        signal,
      ),
    { enabled: !(watchMode && watchlist.length === 0) },
  );

  const remote = useResource<GameSearchResponse>(
    `remote:${submittedQuery ?? 'none'}:${version}`,
    (signal) => searchGames(submittedQuery ?? '', signal),
    { enabled: Boolean(submittedQuery) },
  );

  const items = useMemo(() => games.data?.items ?? [], [games.data]);
  const platinumGold = useMemo(
    () => items.filter((game) => game.tier === 'platinum' || game.tier === 'gold').length,
    [items],
  );
  const supported = useMemo(
    () => items.filter((game) => game.awaStatus === 'Supported').length,
    [items],
  );

  const linkFor = (appid: number) => {
    const next = new URLSearchParams(params);
    next.set('game', String(appid));
    return `/games?${next.toString()}`;
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchInput.trim();
    if (query.length < 2) return;
    setSubmittedQuery(query);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('q', query);
        next.set('featured', '0');
        next.delete('watch');
        next.delete('game');
        return next;
      },
      { replace: true },
    );
  };

  const clearSearch = () => {
    setSearchInput('');
    setSubmittedQuery(null);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('q');
        next.delete('game');
        return next;
      },
      { replace: true },
    );
  };

  const handleToggleWatch = (appid: number) => {
    const wasWatched = isWatched(appid);
    toggleWatch(appid);
    showToast(wasWatched ? 'Removed from watchlist.' : 'Added to watchlist.', 'info');
  };

  const heading = watchMode
    ? 'Your watchlist'
    : submittedQuery || qParam
      ? 'Tracked matches'
      : featured
        ? 'Featured compatibility'
        : 'All tracked games';

  return (
    <>
      <section className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-wine-300">
          Compatibility lab
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">
          Will it run on Linux?
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist-400">
          Search any Steam game, check ProtonDB tiers and trends, and see anti-cheat status from
          Are We Anti-Cheat Yet. Featured top sellers and new releases are refreshed every few
          hours.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Games tracked"
            value={stats?.counts.games ?? '—'}
            hint="in the local index"
            icon={<Gamepad2 className="h-4 w-4" />}
          />
          <StatCard
            label="Platinum + gold"
            value={platinumGold}
            hint="in the current list"
            icon={<Sparkles className="h-4 w-4" />}
            tone="text-emerald-200"
          />
          <StatCard
            label="Anti-cheat OK"
            value={supported}
            hint="AWA Supported"
            icon={<ShieldCheck className="h-4 w-4" />}
            tone="text-proton-200"
          />
          <StatCard
            label="Tier changes"
            value={stats?.counts.compatEvents ?? 0}
            hint="all-time snapshots"
            icon={<TrendingUp className="h-4 w-4" />}
            tone="text-amber-200"
          />
        </div>
      </section>

      <form
        onSubmit={submitSearch}
        className="mb-4 rounded-xl border border-ink-700/70 bg-ink-850/60 p-3"
        role="search"
      >
        <label htmlFor="game-search" className="sr-only">
          Search Steam games
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" aria-hidden="true" />
            <input
              id="game-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search any Steam game — e.g. Elden Ring, Helldivers 2, GTA V…"
              className="w-full rounded-lg border border-ink-600 bg-ink-900 py-2.5 pl-9 pr-9 text-sm text-mist-100 placeholder:text-mist-500 focus:border-proton-500/60 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear game search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-mist-500 hover:text-mist-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searchInput.trim().length < 2 || remote.loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-proton-500/40 bg-proton-500/15 px-4 py-2.5 text-sm font-medium text-proton-100 transition hover:border-proton-400/70 hover:bg-proton-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remote.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            Search Steam
          </button>
        </div>
        <p className="mt-2 text-[10px] text-mist-500">
          Local results update as you type. “Search Steam” queries Steam and ProtonDB on demand;
          lookups are cached for six hours.
        </p>
      </form>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-ink-700/70 bg-ink-850/60 p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-1">
          {TIER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updateParam('tier', option === 'all' ? null : option)}
              aria-pressed={tier === option}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-medium capitalize transition ${
                tier === option
                  ? 'border-proton-500/40 bg-proton-500/10 text-proton-200'
                  : 'border-ink-600 bg-ink-900 text-mist-400 hover:text-mist-200'
              }`}
            >
              {option === 'all' ? 'All tiers' : TIER_META[option].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <label className="sr-only" htmlFor="game-sort">
            Sort games
          </label>
          <select
            id="game-sort"
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value)}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-[11px] text-mist-300 focus:border-proton-500/60 focus:outline-none"
          >
            {GAME_SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  if (featured) next.set('featured', '0');
                  else next.delete('featured');
                  next.delete('watch');
                  next.delete('game');
                  return next;
                },
                { replace: true },
              );
            }}
            aria-pressed={featured}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition ${
              featured
                ? 'border-proton-500/40 bg-proton-500/10 text-proton-200'
                : 'border-ink-600 bg-ink-900 text-mist-400 hover:text-mist-200'
            }`}
          >
            Featured only
          </button>

          <button
            type="button"
            onClick={() => {
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  if (watchMode) next.delete('watch');
                  else next.set('watch', '1');
                  next.set('featured', '0');
                  next.delete('game');
                  return next;
                },
                { replace: true },
              );
            }}
            aria-pressed={watchMode}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition ${
              watchMode
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                : 'border-ink-600 bg-ink-900 text-mist-400 hover:text-mist-200'
            }`}
          >
            <Star className="h-3 w-3" fill={watchMode ? 'currentColor' : 'none'} aria-hidden="true" />
            Watchlist
            <span className="text-mist-500">{watchlist.length}</span>
          </button>
        </div>
      </div>

      {submittedQuery && (
        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-mist-200">
              Steam results for “{submittedQuery}”
            </h2>
            {remote.data && (
              <span className="text-[10px] text-mist-500">
                {remote.data.items.length} {remote.data.items.length === 1 ? 'game' : 'games'}
                {!remote.data.remote ? ' · Steam unavailable, showing local matches' : ''}
              </span>
            )}
            <button
              type="button"
              onClick={clearSearch}
              className="ml-auto text-[10px] text-proton-400 hover:text-proton-300"
            >
              Clear search
            </button>
          </div>
          {remote.loading && !remote.data && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              <GameCardSkeleton />
              <GameCardSkeleton />
              <GameCardSkeleton />
            </div>
          )}
          {remote.error && !remote.data && <ErrorState message={remote.error} onRetry={remote.reload} />}
          {remote.data && remote.data.items.length === 0 && (
            <EmptyState
              title="No Steam matches"
              description="Steam did not return a game for that query. Try a shorter title or check the spelling."
            />
          )}
          {remote.data && remote.data.items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {remote.data.items.map((game) => (
                <GameCard
                  key={game.appid}
                  game={game}
                  watched={isWatched(game.appid)}
                  onToggleWatch={handleToggleWatch}
                  to={linkFor(game.appid)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-mist-200">{heading}</h2>
          {games.data && (
            <span className="text-[10px] text-mist-500">
              {games.data.items.length} of {games.data.total}
            </span>
          )}
          {qParam && !submittedQuery && (
            <span className="text-[10px] text-mist-500">local matches for “{qParam}”</span>
          )}
        </div>

        {watchMode && watchlist.length === 0 && (
          <EmptyState
            title="Your watchlist is empty"
            description="Star games from the grid or from a game's detail panel. Watchlisted games stay here between visits."
            icon={<Star className="h-6 w-6" aria-hidden="true" />}
            action={
              <button
                type="button"
                onClick={() => updateParam('watch', null)}
                className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-200 hover:text-white"
              >
                Browse games
              </button>
            }
          />
        )}

        {!watchMode || watchlist.length > 0 ? (
          <>
            {games.loading && items.length === 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                <GameCardSkeleton />
                <GameCardSkeleton />
                <GameCardSkeleton />
                <GameCardSkeleton />
                <GameCardSkeleton />
                <GameCardSkeleton />
              </div>
            )}
            {games.error && items.length === 0 && (
              <ErrorState message={games.error} onRetry={games.reload} />
            )}
            {!games.loading && !games.error && items.length === 0 && (
              <EmptyState
                title="No games match"
                description="Try a different tier, clear the search, or switch from featured to all tracked games."
                icon={<Gamepad2 className="h-6 w-6" aria-hidden="true" />}
              />
            )}
            {items.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((game) => (
                  <GameCard
                    key={game.appid}
                    game={game}
                    watched={isWatched(game.appid)}
                    onToggleWatch={handleToggleWatch}
                    to={linkFor(game.appid)}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      <GameDrawer
        appid={gameParam ? Number(gameParam) : null}
        onClose={() => updateParam('game', null)}
      />
    </>
  );
}
