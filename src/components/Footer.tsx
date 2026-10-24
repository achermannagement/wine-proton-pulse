import { ExternalLink, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-ink-800/80 bg-ink-950/60">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-6 text-[11px] text-mist-500 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p className="max-w-2xl leading-relaxed">
          Unofficial fan dashboard. Not affiliated with Valve, WineHQ, ProtonDB, or Are We
          Anti-Cheat Yet. Headlines and changelog excerpts link back to their original sources.
        </p>
        <div className="flex items-center gap-4">
          <Link to="/sources" className="inline-flex items-center gap-1 transition hover:text-mist-300">
            Data sources
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
          <span className="inline-flex items-center gap-1">
            Built for the Linux gaming community
            <Heart className="h-3 w-3 text-wine-400" aria-hidden="true" />
          </span>
        </div>
      </div>
    </footer>
  );
}
