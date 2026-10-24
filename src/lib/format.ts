import type { ProtonTier } from './types';

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelativeTime(epochSeconds: number | null | undefined, now = Date.now() / 1000): string {
  if (!epochSeconds) return 'unknown';
  const delta = Math.round(epochSeconds - now);
  const abs = Math.abs(delta);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relativeFormatter.format(Math.round(delta / 60), 'minute');
  if (abs < 86_400) return relativeFormatter.format(Math.round(delta / 3600), 'hour');
  if (abs < 604_800) return relativeFormatter.format(Math.round(delta / 86_400), 'day');
  if (abs < 2_592_000) return relativeFormatter.format(Math.round(delta / 604_800), 'week');
  return relativeFormatter.format(Math.round(delta / 2_592_000), 'month');
}

export function formatDate(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return 'Unknown date';
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return 'Unknown date';
  return new Date(epochSeconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDayLabel(epochSeconds: number, now = Date.now() / 1000): string {
  const date = new Date(epochSeconds * 1000);
  const today = new Date(now * 1000);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

export function formatScore(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(2);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function tierValue(tier: ProtonTier | null | undefined): number {
  switch (tier) {
    case 'platinum':
      return 6;
    case 'gold':
      return 5;
    case 'silver':
      return 4;
    case 'bronze':
      return 3;
    case 'borked':
      return 2;
    case 'pending':
      return 1;
    default:
      return 0;
  }
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function initials(name: string): string {
  return name
    .replace(/[™®©]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function isRecent(epochSeconds: number | null | undefined, hours = 24): boolean {
  if (!epochSeconds) return false;
  return Date.now() / 1000 - epochSeconds < hours * 3600;
}
