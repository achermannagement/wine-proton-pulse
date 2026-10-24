import { Gamepad2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GameDto } from '../lib/types';
import { AwaBadge, TierBadge, TrendingBadge } from './Badges';
import { formatNumber, formatScore, initials } from '../lib/format';

export function GameCard({
  game,
  watched,
  onToggleWatch,
  to,
}: {
  game: GameDto;
  watched: boolean;
  onToggleWatch: (appid: number) => void;
  to?: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-ink-700/70 bg-ink-850/60 transition hover:border-ink-600 hover:bg-ink-850">
      <Link
        to={to ?? `/games?game=${game.appid}`}
        className="block focus-visible:outline-none"
        data-testid={`game-card-${game.appid}`}
      >
        <div className="relative h-28 overflow-hidden bg-gradient-to-br from-ink-800 via-ink-750 to-ink-900">
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-widest text-ink-600">
            {initials(game.name)}
          </div>
          {game.headerImage && (
            <img
              src={game.headerImage}
              alt=""
              loading="lazy"
              className="relative h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
          <div className="absolute left-2 top-2 flex items-center gap-1">
            <TierBadge tier={game.tier} />
            {game.isNative && (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                Native
              </span>
            )}
          </div>
          <h3 className="absolute bottom-2 left-3 right-3 truncate text-sm font-semibold text-white drop-shadow">
            {game.name}
          </h3>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 text-[10px] text-mist-400">
            <span className="inline-flex items-center gap-1">
              <Gamepad2 className="h-3 w-3" aria-hidden="true" />
              {formatNumber(game.reports)} reports
            </span>
            <span aria-hidden="true">·</span>
            <span>Score {formatScore(game.score)}</span>
            {game.trendingTier && game.trendingTier !== game.tier && (
              <>
                <span aria-hidden="true">·</span>
                <TrendingBadge current={game.tier} trending={game.trendingTier} />
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <AwaBadge status={game.awaStatus} />
            {game.previousTier && game.previousTier !== game.tier && (
              <span className="text-[10px] text-mist-500">
                was {game.previousTier}
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onToggleWatch(game.appid)}
        aria-label={watched ? `Remove ${game.name} from watchlist` : `Add ${game.name} to watchlist`}
        aria-pressed={watched}
        className={`absolute right-2 top-2 rounded-lg border p-1.5 backdrop-blur transition ${
          watched
            ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
            : 'border-ink-600/80 bg-ink-950/60 text-mist-400 hover:text-amber-200'
        }`}
      >
        <Star className="h-3.5 w-3.5" fill={watched ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </article>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700/70 bg-ink-850/60">
      <div className="skeleton h-28" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
