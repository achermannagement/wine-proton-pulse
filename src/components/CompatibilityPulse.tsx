import { Activity, ArrowRight, ShieldCheck, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompatEventDto } from '../lib/types';
import { TierBadge } from './Badges';
import { TimeAgo } from './TimeAgo';

export function CompatibilityPulse({ events }: { events: CompatEventDto[] }) {
  return (
    <section className="rounded-xl border border-ink-700/70 bg-ink-850/50">
      <div className="flex items-center justify-between border-b border-ink-700/60 px-3.5 py-2.5">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mist-300">
          <Activity className="h-3.5 w-3.5 text-proton-400" aria-hidden="true" />
          Compatibility pulse
        </h2>
        <Link to="/games" className="text-[10px] text-proton-400 transition hover:text-proton-300">
          All games
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="px-3.5 py-4 text-[11px] leading-relaxed text-mist-500">
          No tier changes recorded yet. ProtonDB ratings are snapshotted as the dashboard
          refreshes, so changes will appear here over time.
        </p>
      ) : (
        <ul className="divide-y divide-ink-800/70">
          {events.map((event) => {
            const isTier = event.type === 'tier-change';
            const Icon = isTier ? TrendingUp : ShieldCheck;
            return (
              <li key={event.id} className="px-3.5 py-2.5">
                <div className="flex items-start gap-2">
                  <Icon
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      isTier ? 'text-proton-400' : 'text-emerald-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-mist-200">
                      {event.appid ? (
                        <Link to={`/games?game=${event.appid}`} className="hover:text-proton-300">
                          {event.gameName}
                        </Link>
                      ) : (
                        event.gameName
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-mist-500">
                      {isTier ? (
                        <>
                          <span className="capitalize">{event.fromValue ?? 'new'}</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          <TierBadge
                            tier={
                              event.toValue as
                                | 'platinum'
                                | 'gold'
                                | 'silver'
                                | 'bronze'
                                | 'borked'
                                | 'pending'
                                | 'unknown'
                            }
                          />
                        </>
                      ) : (
                        <>
                          <span>{event.fromValue ?? 'unknown'}</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          <span className="text-mist-300">{event.toValue}</span>
                        </>
                      )}
                      <span className="ml-auto">
                        <TimeAgo epoch={event.createdAt} />
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
