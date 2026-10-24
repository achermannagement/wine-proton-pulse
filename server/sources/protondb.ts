import type { ProtonTier } from '../../shared/types';
import type { ProtonDbSummary } from '../types';
import type { SyncContext } from '../services/context';
import { HttpError } from '../lib/http';

const TIERS = new Set<ProtonTier>([
  'platinum',
  'gold',
  'silver',
  'bronze',
  'borked',
  'pending',
  'unknown',
]);

function toTier(value: unknown): ProtonTier | null {
  if (typeof value !== 'string') return null;
  const tier = value.toLowerCase() as ProtonTier;
  return TIERS.has(tier) ? tier : null;
}

export function parseProtonDbSummary(value: unknown): ProtonDbSummary {
  if (!value || typeof value !== 'object') {
    return {
      tier: 'pending',
      trendingTier: null,
      bestTier: null,
      score: null,
      confidence: null,
      total: null,
    };
  }
  const data = value as Record<string, unknown>;
  return {
    tier: toTier(data.tier) ?? 'pending',
    trendingTier: toTier(data.trendingTier),
    bestTier: toTier(data.bestReportedTier),
    score: typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : null,
    confidence: typeof data.confidence === 'string' ? data.confidence : null,
    total: typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : null,
  };
}

export async function fetchProtonDbSummary(
  ctx: SyncContext,
  appid: number,
): Promise<ProtonDbSummary | null> {
  try {
    const response = await ctx.http.getJson<unknown>(
      `https://www.protondb.com/api/v1/reports/summaries/${appid}.json`,
    );
    if (response.notModified || response.data == null) return null;
    return parseProtonDbSummary(response.data);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
