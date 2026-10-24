import {
  Activity,
  Clock,
  Database,
  ExternalLink,
  Globe,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import type { SourceDto } from '../lib/types';
import { SOURCE_DESCRIPTIONS, SOURCE_TONE } from '../lib/constants';
import { formatDuration, formatRelativeTime } from '../lib/format';
import { useDashboard } from '../hooks/useDashboard';
import { usePageTitle } from '../hooks/usePageTitle';
import { SourceBadge } from '../components/Badges';
import { TimeAgo } from '../components/TimeAgo';
import { StatCard } from '../components/StatCard';
import { ErrorState, SkeletonCard } from '../components/States';

function statusFor(source: SourceDto): { dot: string; label: string; tone: string } {
  if (!source.enabled) return { dot: 'bg-mist-500', label: 'Disabled', tone: 'text-mist-500' };
  if (source.lastError) return { dot: 'bg-red-400', label: 'Degraded', tone: 'text-red-300' };
  if (source.lastSuccessAt == null) {
    return { dot: 'bg-amber-400', label: 'Waiting', tone: 'text-amber-300' };
  }
  return { dot: 'bg-emerald-400', label: 'Healthy', tone: 'text-emerald-300' };
}

function SourceCard({ source }: { source: SourceDto }) {
  const status = statusFor(source);
  return (
    <article className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge sourceId={source.id} name={source.name} />
            <span className={`inline-flex items-center gap-1 text-[10px] ${status.tone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-mist-500">
              {source.cadence === 'anti-cheat' ? 'anti-cheat' : source.cadence}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-mist-400">
            {SOURCE_DESCRIPTIONS[source.id] ?? 'External data source.'}
          </p>
        </div>
        {source.homepage && (
          <a
            href={source.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[10px] text-mist-400 transition hover:text-mist-200"
          >
            Open
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
        <div className="rounded-lg border border-ink-700/50 bg-ink-900/40 p-2">
          <dt className="text-mist-500">Last success</dt>
          <dd className="mt-0.5 text-mist-300">
            {source.lastSuccessAt ? <TimeAgo epoch={source.lastSuccessAt} /> : '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-ink-700/50 bg-ink-900/40 p-2">
          <dt className="text-mist-500">Duration</dt>
          <dd className="mt-0.5 text-mist-300">{formatDuration(source.lastDurationMs)}</dd>
        </div>
        <div className="rounded-lg border border-ink-700/50 bg-ink-900/40 p-2">
          <dt className="text-mist-500">Last found</dt>
          <dd className="mt-0.5 text-mist-300">{source.itemsFound}</dd>
        </div>
        <div className="rounded-lg border border-ink-700/50 bg-ink-900/40 p-2">
          <dt className="text-mist-500">
            {source.cadence === 'news' ? 'Indexed items' : 'Tracked'}
          </dt>
          <dd className="mt-0.5 text-mist-300">
            {source.cadence === 'news' ? source.itemCount : source.itemsFound}
          </dd>
        </div>
      </dl>

      {source.lastError && (
        <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[10px] leading-relaxed text-red-200">
          {source.lastError}
        </p>
      )}
    </article>
  );
}

export function SourcesView() {
  usePageTitle('Sources');
  const { stats, statsLoading, statsError, refresh, refreshStats, refreshing } = useDashboard();
  const sources = stats?.sources ?? [];
  const groups = [
    { key: 'news', label: 'News and release notes', items: sources.filter((source) => source.cadence === 'news') },
    {
      key: 'compatibility',
      label: 'Game compatibility',
      items: sources.filter((source) => source.cadence === 'compatibility'),
    },
    {
      key: 'anti-cheat',
      label: 'Anti-cheat status',
      items: sources.filter((source) => source.cadence === 'anti-cheat'),
    },
  ];
  const healthy = sources.filter(
    (source) => source.enabled && !source.lastError && source.lastSuccessAt != null,
  ).length;
  const enabled = sources.filter((source) => source.enabled).length;

  return (
    <>
      <section className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Data sources
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">
          Where the pulse comes from
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist-400">
          Official release feeds, community news and crowd-sourced compatibility data. Everything
          is cached, rate-limit aware, and linked back to the original source.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Healthy"
            value={`${healthy}/${enabled}`}
            hint="enabled sources"
            icon={<Activity className="h-4 w-4" />}
            tone={healthy === enabled ? 'text-emerald-200' : 'text-amber-200'}
          />
          <StatCard
            label="Index updated"
            value={stats?.lastUpdated ? formatRelativeTime(stats.lastUpdated) : '—'}
            hint="last completed sync"
            icon={<Database className="h-4 w-4" />}
          />
          <StatCard
            label="Next sync"
            value={stats?.nextRefreshAt ? formatRelativeTime(stats.nextRefreshAt) : 'Manual'}
            hint="scheduler cadence"
            icon={<Clock className="h-4 w-4" />}
            tone="text-proton-200"
          />
          <StatCard
            label="Refresh"
            value={refreshing ? 'Running' : 'Ready'}
            hint="manual trigger"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            tone={refreshing ? 'text-amber-200' : 'text-mist-100'}
          />
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-proton-500/40 bg-proton-500/10 px-3 py-1.5 text-xs font-medium text-proton-200 transition hover:border-proton-400/60 hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'Refreshing sources' : 'Refresh now'}
        </button>
        <button
          type="button"
          onClick={() => void refreshStats()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-850 px-3 py-1.5 text-xs text-mist-300 transition hover:text-white"
        >
          Reload status
        </button>
        <span className="text-[10px] text-mist-500">
          Manual refreshes have a short cooldown. Upstream failures never remove cached data.
        </span>
      </div>

      {statsLoading && !stats && (
        <div className="space-y-3" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {statsError && !stats && <ErrorState message={statsError} onRetry={() => void refreshStats()} />}

      {stats && (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-mist-200">{group.label}</h2>
                <span className="text-[10px] text-mist-500">{group.items.length} sources</span>
                <div className="h-px flex-1 bg-ink-800" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {group.items.map((source) => (
                  <SourceCard key={source.id} source={source} />
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-xl border border-ink-700/70 bg-ink-850/40 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-200">
              <Server className="h-4 w-4 text-proton-400" aria-hidden="true" />
              How the aggregator works
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
                <h3 className="text-xs font-semibold text-mist-200">Polite by default</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-mist-400">
                  Requests use timeouts, retries, ETags where available, and conservative
                  concurrency. Steam and ProtonDB lookups are cached for hours; news refreshes
                  every 30 minutes.
                </p>
              </div>
              <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
                <h3 className="text-xs font-semibold text-mist-200">Parsed, not dumped</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-mist-400">
                  Release notes are split into features, newly playable games, game fixes, general
                  fixes, performance work and anti-cheat changes. Entries link to the original
                  release or bug report.
                </p>
              </div>
              <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-mist-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  Crowd-sourced compatibility
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-mist-400">
                  ProtonDB tiers are player reports, not guarantees. AWA status reflects the
                  anti-cheat project’s latest public assessment. Always check the source before
                  buying a game.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-ink-700/70 bg-ink-850/40 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-200">
              <Globe className="h-4 w-4 text-wine-300" aria-hidden="true" />
              Attribution
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-mist-400">
              This is an unofficial fan dashboard. Headlines and changelog excerpts remain the
              property of their original publishers. Data is linked back to:
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sources
                .filter((source) => source.homepage)
                .map((source) => (
                  <a
                    key={source.id}
                    href={source.homepage ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition hover:brightness-125 ${
                      SOURCE_TONE[source.id] ?? 'border-ink-600 bg-ink-800 text-mist-300'
                    }`}
                  >
                    {source.name}
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-mist-500">
              Not affiliated with Valve, WineHQ, ProtonDB, GamingOnLinux, Phoronix, BoilingSteam,
              Reddit, or Are We Anti-Cheat Yet. Steam and ProtonDB endpoints are unofficial public
              interfaces and may change without notice.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
