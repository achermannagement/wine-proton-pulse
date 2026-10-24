export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function parseDateToEpoch(value: string | number | Date | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function dayStartSeconds(epochSeconds: number): number {
  return Math.floor(epochSeconds / 86_400) * 86_400;
}

export function hoursAgo(now: number, hours: number): number {
  return now - hours * 3600;
}

export function isOlderThan(epochSeconds: number | null | undefined, now: number, hours: number): boolean {
  if (epochSeconds == null) return true;
  return epochSeconds < hoursAgo(now, hours);
}

export function relativeDayLabel(epochSeconds: number, now = nowSeconds()): string {
  const delta = now - epochSeconds;
  if (delta < 0) return 'Scheduled';
  if (delta < 60) return 'just now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 604_800) return `${Math.floor(delta / 86_400)}d ago`;
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
