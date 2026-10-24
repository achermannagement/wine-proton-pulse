import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'text-mist-100',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700/80 bg-ink-850/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-mist-500">
            {label}
          </div>
          {hint && <div className="mt-0.5 text-[10px] text-mist-500">{hint}</div>}
        </div>
        {icon && <div className="rounded-lg bg-ink-800 p-1.5 text-mist-400">{icon}</div>}
      </div>
    </div>
  );
}
