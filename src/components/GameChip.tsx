import { Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GameMention } from '../lib/types';

export function GameChip({ game }: { game: GameMention }) {
  const className =
    'inline-flex max-w-[220px] items-center gap-1 rounded-md border border-ink-600 bg-ink-800/80 px-1.5 py-0.5 text-[10px] text-mist-300 transition hover:border-proton-500/50 hover:text-proton-300';
  if (game.appid != null) {
    return (
      <Link to={`/games?game=${game.appid}`} className={className} title={`${game.name} compatibility`}>
        <Gamepad2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{game.name}</span>
      </Link>
    );
  }
  return (
    <a
      href={`https://www.protondb.com/search?q=${encodeURIComponent(game.name)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={`Search ${game.name} on ProtonDB`}
    >
      <Gamepad2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{game.name}</span>
    </a>
  );
}

export function GameChips({ games, max = 4 }: { games: GameMention[]; max?: number }) {
  if (games.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {games.slice(0, max).map((game) => (
        <GameChip key={`${game.appid ?? game.name}-${game.name}`} game={game} />
      ))}
      {games.length > max && (
        <span className="text-[10px] text-mist-500">+{games.length - max}</span>
      )}
    </span>
  );
}
