import { useId } from 'react';
import type { GameHistoryPoint } from '../lib/types';
import { TIER_META } from '../lib/constants';
import { formatDate, tierValue } from '../lib/format';

export function Sparkline({ history }: { history: GameHistoryPoint[] }) {
  const gradientId = useId().replace(/:/g, '');
  if (history.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-ink-700/60 bg-ink-900/40 text-[11px] text-mist-500">
        Not enough snapshots yet — history builds as the dashboard refreshes.
      </div>
    );
  }

  const points = history.slice(-30);
  const width = 240;
  const height = 56;
  const padding = 4;
  const maxValue = 6;
  const stepX = (width - padding * 2) / Math.max(1, points.length - 1);
  const coords = points.map((point, index) => {
    const value = tierValue(point.tier);
    const x = padding + index * stepX;
    const y = padding + (1 - value / maxValue) * (height - padding * 2);
    return { x, y, point };
  });
  const line = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const last = points[points.length - 1];
  const lastMeta = TIER_META[last?.tier ?? 'unknown'];

  return (
    <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
      <div className="mb-1 flex items-center justify-between text-[10px] text-mist-500">
        <span>ProtonDB tier history</span>
        <span className={lastMeta.tone.split(' ').slice(-1)[0]}>{lastMeta.label}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-16 w-full text-proton-400"
        role="img"
        aria-label={`ProtonDB tier history from ${formatDate(points[0]?.day)} to ${formatDate(
          points[points.length - 1]?.day,
        )}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4, 5, 6].map((value) => {
          const y = padding + (1 - value / maxValue) * (height - padding * 2);
          return (
            <line
              key={value}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.06"
              strokeWidth="1"
            />
          );
        })}
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map(({ x, y, point }, index) => (
          <circle
            key={`${point.day}-${index}`}
            cx={x}
            cy={y}
            r={index === coords.length - 1 ? 2.8 : 1.8}
            fill="currentColor"
          >
            <title>
              {formatDate(point.day)}: {TIER_META[point.tier ?? 'unknown'].label}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
