import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Package, Sparkles, Timer, Wrench } from 'lucide-react';
import type { ReleaseResponse } from '../lib/types';
import { fetchReleases } from '../lib/api';
import { RELEASE_SOURCE_IDS, SOURCE_DESCRIPTIONS } from '../lib/constants';
import { formatDate } from '../lib/format';
import { useDashboard } from '../hooks/useDashboard';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import { ReleaseCard } from '../components/ReleaseCard';
import { ItemDrawer } from '../components/ItemDrawer';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState, SkeletonCard } from '../components/States';

export function ReleasesView() {
  usePageTitle('Releases');
  const [params, setParams] = useSearchParams();
  const { stats, version } = useDashboard();
  const source = params.get('source');
  const releaseId = params.get('release');
  const releases = useResource<ReleaseResponse>(`releases:${version}`, (signal) =>
    fetchReleases(signal),
  );

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== 'release') next.delete('release');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const sourceName = (id: string) => stats?.sources.find((item) => item.id === id)?.name ?? id;
  const sourceHome = (id: string) =>
    stats?.sources.find((item) => item.id === id)?.homepage ?? null;

  const filteredItems = useMemo(
    () =>
      (releases.data?.items ?? []).filter((item) => !source || item.sourceId === source),
    [releases.data, source],
  );
  const filteredLatest = useMemo(
    () => (releases.data?.latest ?? []).filter((item) => !source || item.sourceId === source),
    [releases.data, source],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const list = map.get(item.sourceId) ?? [];
      list.push(item);
      map.set(item.sourceId, list);
    }
    return [...map.entries()];
  }, [filteredItems]);

  const totalChanges = filteredItems.reduce((sum, item) => sum + item.entryCount, 0);
  const latest = filteredItems[0];

  return (
    <>
      <section className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-proton-400">
          Release tracker
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">
          Release notes, decoded
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist-400">
          Every Wine, Proton, GE-Proton, DXVK and VKD3D-Proton release is parsed into features,
          newly playable games, game-specific fixes, general bug fixes and performance work.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Releases"
            value={filteredItems.length}
            hint="in the recent window"
            icon={<Package className="h-4 w-4" />}
          />
          <StatCard
            label="Parsed changes"
            value={totalChanges}
            hint="features, fixes and more"
            icon={<Wrench className="h-4 w-4" />}
            tone="text-amber-200"
          />
          <StatCard
            label="Projects"
            value={new Set(filteredItems.map((item) => item.sourceId)).size}
            hint="active release sources"
            icon={<Sparkles className="h-4 w-4" />}
            tone="text-proton-200"
          />
          <StatCard
            label="Latest"
            value={latest ? formatDate(latest.publishedAt) : '—'}
            hint={latest ? latest.title : 'waiting for first sync'}
            icon={<Timer className="h-4 w-4" />}
            tone="text-emerald-200"
          />
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => updateParam('source', null)}
          aria-pressed={source == null}
          className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition ${
            source == null
              ? 'border-proton-500/40 bg-proton-500/10 text-proton-200'
              : 'border-ink-600 bg-ink-850 text-mist-400 hover:text-mist-200'
          }`}
        >
          All projects
        </button>
        {RELEASE_SOURCE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => updateParam('source', source === id ? null : id)}
            aria-pressed={source === id}
            className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition ${
              source === id
                ? 'border-proton-500/40 bg-proton-500/10 text-proton-200'
                : 'border-ink-600 bg-ink-850 text-mist-400 hover:text-mist-200'
            }`}
          >
            {sourceName(id)}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-ink-700/60 bg-ink-850/40 p-3 text-[11px] leading-relaxed text-mist-400">
        <strong className="font-semibold text-mist-200">Reading the notes:</strong> “Newly
        playable” means a game now launches; “Game fix” is a bug fix tied to a game; “Feature”
        covers general improvements. Changelog entries link back to the original release or bug
        report.
      </div>

      {releases.loading && !releases.data && (
        <div className="space-y-3" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {releases.error && !releases.data && (
        <ErrorState message={releases.error} onRetry={releases.reload} />
      )}

      {releases.data && filteredItems.length === 0 && (
        <EmptyState
          title="No releases match this project"
          description="Pick another project or clear the filter. New releases appear automatically after the next sync."
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
        />
      )}

      {filteredLatest.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-mist-500">
              Latest versions
            </h2>
            <div className="h-px flex-1 bg-ink-800" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredLatest.map((item) => (
              <ReleaseCard
                key={item.id}
                item={item}
                featured
                onOpen={(id) => updateParam('release', id)}
              />
            ))}
          </div>
        </section>
      )}

      {grouped.map(([sourceId, items]) => {
        const homepage = sourceHome(sourceId);
        return (
          <section key={sourceId} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-mist-200">{sourceName(sourceId)}</h2>
              <span className="text-[10px] text-mist-500">{items.length} recent releases</span>
              {homepage && (
                <a
                  href={homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-mist-500 transition hover:text-mist-300"
                >
                  Project page
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
            <p className="mb-2 text-[11px] text-mist-500">{SOURCE_DESCRIPTIONS[sourceId]}</p>
            <div className="space-y-2.5">
              {items.map((item) => (
                <ReleaseCard
                  key={item.id}
                  item={item}
                  onOpen={(id) => updateParam('release', id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <ItemDrawer itemId={releaseId} onClose={() => updateParam('release', null)} />
    </>
  );
}
