import {
  Gamepad2,
  Newspaper,
  Package,
  Radio,
  RefreshCw,
  Wine,
  Zap,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { TimeAgo } from './TimeAgo';

const NAV = [
  { to: '/', label: 'Feed', icon: Newspaper, end: true },
  { to: '/games', label: 'Games', icon: Gamepad2 },
  { to: '/releases', label: 'Releases', icon: Package },
  { to: '/sources', label: 'Sources', icon: Radio },
];

const STATUS_META = {
  live: { label: 'Live', dot: 'bg-emerald-400 live-dot', text: 'text-emerald-300' },
  connecting: { label: 'Connecting', dot: 'bg-amber-400', text: 'text-amber-300' },
  offline: { label: 'Offline', dot: 'bg-red-400', text: 'text-red-300' },
};

export function Header() {
  const { stats, status, refresh, refreshing } = useDashboard();
  const statusMeta = STATUS_META[status];

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
        <NavLink to="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-wine-500/30 bg-gradient-to-br from-wine-500/20 to-proton-500/20">
            <Wine className="h-4 w-4 text-wine-300" aria-hidden="true" />
            <Zap className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-ink-950 p-0.5 text-proton-300" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-mist-100">
              Wine &amp; Proton <span className="text-gradient">Pulse</span>
            </span>
            <span className="hidden text-[10px] text-mist-500 sm:block">
              Linux gaming compatibility, distilled
            </span>
          </span>
        </NavLink>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-ink-800 text-mist-100 shadow-sm'
                    : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className="hidden items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850/80 px-2.5 py-1 text-[10px] font-medium sm:inline-flex"
            title="Live updates are delivered over Server-Sent Events"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
            <span className={statusMeta.text}>{statusMeta.label}</span>
          </span>
          {stats?.lastUpdated && (
            <span className="hidden text-[10px] text-mist-500 lg:inline">
              Updated <TimeAgo epoch={stats.lastUpdated} />
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-mist-200 transition hover:border-proton-500/60 hover:text-white disabled:cursor-wait disabled:opacity-60"
            aria-label={refreshing ? 'Refreshing sources' : 'Refresh all sources'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <nav
        className="no-scrollbar flex gap-1 overflow-x-auto border-t border-ink-800/70 px-4 py-2 md:hidden"
        aria-label="Mobile navigation"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                isActive
                  ? 'bg-ink-800 text-mist-100'
                  : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200'
              }`
            }
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
