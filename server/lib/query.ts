import type { ProtonTier } from '../../shared/types';

export function queryString(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function queryInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function queryBool(value: unknown): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export function queryEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function queryAppIds(value: unknown): number[] {
  if (typeof value !== 'string') return [];
  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].slice(0, 100);
}

export function queryTier(value: unknown): ProtonTier | null {
  const allowed = ['platinum', 'gold', 'silver', 'bronze', 'borked', 'pending', 'unknown'] as const;
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as ProtonTier)
    : null;
}

export function queryRange(value: unknown): '24h' | '7d' | '30d' | 'all' {
  return queryEnum(value, ['24h', '7d', '30d', 'all'] as const, 'all');
}

export function queryCategory(value: unknown): string | null {
  return queryEnum(
    value,
    ['all', 'feature', 'gamefix', 'bugfix', 'compat', 'release', 'discussion', 'anticheat'] as const,
    'all',
  ) === 'all'
    ? null
    : queryString(value, 30);
}
