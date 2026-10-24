import {
  ArrowRight,
  ExternalLink,
  Gamepad2,
  History,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GameDetailResponse, ProtonTier } from '../lib/types';
import { fetchGame } from '../lib/api';
import { formatDate, formatNumber, formatScore, initials } from '../lib/format';
import { TIER_META } from '../lib/constants';
import { useResource } from '../hooks/useResource';
import { useDashboard } from '../hooks/useDashboard';
import { Drawer } from './Drawer';
import { AwaBadge, SourceBadge, TierBadge, TrendingBadge } from './Badges';
import { Sparkline } from './Sparkline';
import { ErrorState, SkeletonLine } from './States';
import { TimeAgo } from './TimeAgo';

export function GameDrawer({
  appid,
  onClose,
}: {
  appid: number | null;
  onClose: () => void;
}) {
  const { isWatched, toggleWatch, showToast } = useDashboard();
  const { data, loading, error, reload } = useResource<GameDetailResponse>(
    `game:${appid ?? 'none'}`,
    (signal) => fetchGame(appid ?? 0, signal),
    { enabled: Boolean(appid), resetOnKey: true },
  );

  if (!appid) return null;

  const watched = isWatched(appid);
  const game = data?.game;
  const anticheat = data?.anticheat;
  const steamUrl = game?.storeUrl ?? `https://store.steampowered.com/app/${appid}/`;
  const protonDbUrl = `https://www.protondb.com/app/${appid}`;
  const awaUrl = game?.awaUrl ?? anticheat?.url ?? `https://areweanticheatyet.com/?search=${appid}`;

  return (
    <Drawer
      open
      onClose={onClose}
      title={game?.name ?? 'Loading game…'}
      subtitle={
        game ? (
          <span className="flex flex-wrap items-center gap-2">
            <TierBadge tier={game.tier} />
            <span>{formatNumber(game.reports)} reports</span>
            <span aria-hidden="true">·</span>
            <span>checked <TimeAgo epoch={game.fetchedAt} /></span>
          </span>
        ) : null
      }
      footer={
        game ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                toggleWatch(game.appid);
                showToast(
                  watched ? `${game.name} removed from watchlist.` : `${game.name} added to watchlist.`,
                  'info',
                );
              }}
              aria-pressed={watched}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                watched
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                  : 'border-ink-600 bg-ink-800 text-mist-300 hover:text-white'
              }`}
            >
              <Star className="h-3.5 w-3.5" fill={watched ? 'currentColor' : 'none'} aria-hidden="true" />
              {watched ? 'Watching' : 'Watch game'}
            </button>
            <a
              href={steamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-300 transition hover:text-white"
            >
              Steam
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href={protonDbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-300 transition hover:text-white"
            >
              ProtonDB
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href={awaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-300 transition hover:text-white"
            >
              AWA
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        ) : null
      }
    >
      {loading && !data && (
        <div className="space-y-3">
          <SkeletonLine className="h-40 w-full" />
          <SkeletonLine className="h-5 w-2/3" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-24 w-full" />
        </div>
      )}

      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && game && (
        <div className="space-y-5">
          <div className="relative h-40 overflow-hidden rounded-xl border border-ink-700/70 bg-gradient-to-br from-ink-800 to-ink-900">
            <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-widest text-ink-600">
              {initials(game.name)}
            </div>
            {game.headerImage && (
              <img
                src={game.headerImage}
                alt=""
                className="relative h-full w-full object-cover opacity-85"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/20 to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <TierBadge tier={game.tier} size="md" />
              {game.isNative && (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Native Linux
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-mist-500">Tier</div>
              <div className="mt-1 text-sm font-semibold text-mist-100">
                {TIER_META[game.tier ?? 'unknown'].label}
              </div>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-mist-500">Score</div>
              <div className="mt-1 text-sm font-semibold text-mist-100">{formatScore(game.score)}</div>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-mist-500">Reports</div>
              <div className="mt-1 text-sm font-semibold text-mist-100">
                {formatNumber(game.reports)}
              </div>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-mist-500">Confidence</div>
              <div className="mt-1 text-sm font-semibold capitalize text-mist-100">
                {game.confidence ?? '—'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AwaBadge status={game.awaStatus ?? anticheat?.status ?? null} />
            <TrendingBadge current={game.tier} trending={game.trendingTier} />
            {game.bestTier && game.bestTier !== game.tier && (
              <span className="text-[10px] text-mist-500">
                Best reported: {TIER_META[game.bestTier].label}
              </span>
            )}
            {game.tierChangedAt && (
              <span className="text-[10px] text-mist-500">
                Tier changed <TimeAgo epoch={game.tierChangedAt} />
              </span>
            )}
          </div>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mist-400">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              Compatibility history
            </h3>
            <Sparkline history={data.history} />
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mist-400">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Recent changes
            </h3>
            {data.events.length === 0 ? (
              <p className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3 text-[11px] text-mist-500">
                No compatibility changes recorded for this game yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-850/40 px-2.5 py-2 text-[11px]"
                  >
                    <ArrowRight className="h-3 w-3 text-proton-400" aria-hidden="true" />
                    <span className="capitalize text-mist-400">{event.fromValue ?? 'unknown'}</span>
                    <ArrowRight className="h-3 w-3 text-mist-600" aria-hidden="true" />
                    {event.type === 'tier-change' ? (
                      <TierBadge tier={event.toValue as ProtonTier} />
                    ) : (
                      <span className="text-mist-200">{event.toValue}</span>
                    )}
                    <span className="ml-auto text-[10px] text-mist-500">
                      <TimeAgo epoch={event.createdAt} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mist-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Anti-cheat
            </h3>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <AwaBadge status={anticheat?.status ?? game.awaStatus} />
                {(anticheat?.anticheats.length ?? 0) > 0 && (
                  <span className="text-[11px] text-mist-400">
                    {anticheat?.anticheats.join(', ')}
                  </span>
                )}
              </div>
              {anticheat && anticheat.notes.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {anticheat.notes.slice(0, 3).map((note, index) => (
                    <li key={`${note.text}-${index}`} className="text-[11px] leading-relaxed text-mist-400">
                      {note.url ? (
                        <a
                          href={note.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-proton-300"
                        >
                          {note.text}
                        </a>
                      ) : (
                        note.text
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!anticheat && (
                <p className="mt-1 text-[11px] text-mist-500">
                  Not tracked by Are We Anti-Cheat Yet. Multiplayer titles may still use
                  anti-cheat.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mist-400">
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
              Related news
            </h3>
            {data.relatedNews.length === 0 ? (
              <p className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3 text-[11px] text-mist-500">
                No changelog mentions found for this game yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.relatedNews.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/?item=${item.id}`}
                      onClick={onClose}
                      className="block rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5 transition hover:border-ink-600"
                    >
                      <div className="flex items-center gap-1.5">
                        <SourceBadge sourceId={item.sourceId} name={item.sourceName} />
                        <span className="ml-auto text-[10px] text-mist-500">
                          <TimeAgo epoch={item.publishedAt ?? item.discoveredAt} />
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-mist-300">{item.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[10px] text-mist-500">
            ProtonDB data is crowd-sourced and unofficial. Compatibility can change with game and
            Proton updates. Last checked {formatDate(game.fetchedAt)}.
          </p>
        </div>
      )}
    </Drawer>
  );
}
