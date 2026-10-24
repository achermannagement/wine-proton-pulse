import type { Row } from '@libsql/client';
import type { ProtonTier } from '../../shared/types';
import type { GameRecordInput, ProtonDbSummary, SteamFeaturedGame, SteamSearchResult } from '../types';
import type { SyncContext } from './context';
import { fetchAwaGames } from '../sources/awa';
import { fetchProtonDbSummary } from '../sources/protondb';
import {
  fetchSteamAppDetails,
  fetchSteamFeatured,
  fetchSteamSearch,
} from '../sources/steam';
import {
  applyAwaToGames,
  getAnticheatForName,
  getGameRow,
  getMeta,
  getSearchCache,
  queryGames,
  resetFeaturedGames,
  setMeta,
  setSearchCache,
  upsertAwaGames,
  upsertGame,
  getGameDetail,
} from '../db/repository';
import { sleep } from '../lib/http';
import { POPULAR_GAMES, popularHeaderImage } from '../lib/popularGames';
import { nameKey } from '../lib/text';

const SEARCH_CACHE_SECONDS = 3600;

function tierFrom(value: unknown): ProtonTier | null {
  return value == null ? null : (String(value) as ProtonTier);
}

function existingSummary(row: Row | null): ProtonDbSummary | null {
  if (!row || row.tier == null) return null;
  return {
    tier: String(row.tier) as ProtonTier,
    trendingTier: tierFrom(row.trending_tier),
    bestTier: tierFrom(row.best_tier),
    score: row.score == null ? null : Number(row.score),
    confidence: row.confidence == null ? null : String(row.confidence),
    total: row.reports == null ? null : Number(row.reports),
  };
}

function isFresh(row: Row | null, now: number, hours: number): boolean {
  if (!row || row.tier == null) return false;
  return now - Number(row.fetched_at) < hours * 3600;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, () => run()),
  );
  return results;
}

function gameInputFromFeatured(
  game: SteamFeaturedGame,
  summary: ProtonDbSummary,
  existing: Row | null,
  now: number,
  fetchedAt: number,
): GameRecordInput {
  return {
    appid: game.appid,
    name: game.name,
    headerImage: game.headerImage ?? (existing?.header_image == null ? null : String(existing.header_image)),
    storeUrl: game.storeUrl,
    tier: summary.tier,
    trendingTier: summary.trendingTier,
    bestTier: summary.bestTier,
    score: summary.score,
    confidence: summary.confidence,
    reports: summary.total,
    isNative: game.isNative,
    featured: true,
    releaseDate: existing?.release_date == null ? null : String(existing.release_date),
    fetchedAt,
  };
}

export async function syncFeaturedGames(ctx: SyncContext): Promise<{
  games: number;
  tierChanges: number;
  failed: number;
  steamFailed: boolean;
}> {
  const now = ctx.now();
  let steamGames: SteamFeaturedGame[] = [];
  let steamFailed = false;
  try {
    steamGames = await fetchSteamFeatured(ctx);
  } catch (error) {
    steamFailed = true;
    ctx.log(
      `[games] Steam featured fetch failed, using the popular shelf: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const byAppid = new Map<number, SteamFeaturedGame>();
  for (const game of steamGames) byAppid.set(game.appid, game);
  await mapLimit(POPULAR_GAMES, 2, async (popular) => {
    if (byAppid.has(popular.appid)) return;
    const existing = await getGameRow(ctx.db, popular.appid);
    const existingImage = existing?.header_image == null ? null : String(existing.header_image);
    let details = null;
    if (!existingImage || existingImage.includes('cdn.cloudflare.steamstatic.com')) {
      try {
        details = await fetchSteamAppDetails(ctx, popular.appid);
      } catch (error) {
        ctx.log(
          `[games] Steam details failed for popular game ${popular.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    byAppid.set(popular.appid, {
      appid: popular.appid,
      name: details?.name ?? (existing?.name ? String(existing.name) : popular.name),
      headerImage: details?.headerImage ?? existingImage ?? popularHeaderImage(popular.appid),
      storeUrl: details?.storeUrl ?? `https://store.steampowered.com/app/${popular.appid}/`,
      isNative:
        details?.isNative ??
        (existing ? Boolean(existing.is_native) : Boolean(popular.isNative)),
    });
  });

  const featured = [...byAppid.values()];
  if (featured.length === 0) {
    throw new Error('No featured or popular games available');
  }

  await resetFeaturedGames(ctx.db);
  let tierChanges = 0;
  let failed = 0;

  const results = await mapLimit(featured, 2, async (game) => {
    const existing = await getGameRow(ctx.db, game.appid);
    if (isFresh(existing, now, ctx.config.gamesRefreshHours)) {
      const summary = existingSummary(existing);
      if (summary) {
        const result = await upsertGame(
          ctx.db,
          gameInputFromFeatured(game, summary, existing, now, Number(existing?.fetched_at ?? now)),
          now,
        );
        if (result.tierChanged) tierChanges++;
        return;
      }
    }

    try {
      await sleep(120);
      const summary = await fetchProtonDbSummary(ctx, game.appid);
      const result = await upsertGame(
        ctx.db,
        gameInputFromFeatured(
          game,
          summary ?? {
            tier: 'pending',
            trendingTier: null,
            bestTier: null,
            score: null,
            confidence: null,
            total: null,
          },
          existing,
          now,
          now,
        ),
        now,
      );
      if (result.tierChanged) tierChanges++;
    } catch (error) {
      failed++;
      ctx.log(
        `[games] ProtonDB failed for ${game.name} (${game.appid}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      const summary = existingSummary(existing);
      if (summary) {
        const result = await upsertGame(
          ctx.db,
          gameInputFromFeatured(
            game,
            summary,
            existing,
            now,
            Number(existing?.fetched_at ?? now),
          ),
          now,
        );
        if (result.tierChanged) tierChanges++;
      } else {
        await upsertGame(
          ctx.db,
          gameInputFromFeatured(
            game,
            {
              tier: 'pending',
              trendingTier: null,
              bestTier: null,
              score: null,
              confidence: null,
              total: null,
            },
            existing,
            now,
            now,
          ),
          now,
        );
      }
    }
  });

  await applyAwaToGames(ctx.db);
  await setMeta(ctx.db, 'last_games_sync_at', String(now));
  ctx.broadcast('games_update', {
    games: results.length,
    tierChanges,
    failed,
    timestamp: now * 1000,
  });

  return { games: results.length, tierChanges, failed, steamFailed };
}

async function buildSearchGame(
  ctx: SyncContext,
  result: SteamSearchResult,
  now: number,
): Promise<void> {
  const existing = await getGameRow(ctx.db, result.appid);
  if (isFresh(existing, now, ctx.config.gamesRefreshHours)) return;

  let summary: ProtonDbSummary | null = null;
  try {
    await sleep(120);
    summary = await fetchProtonDbSummary(ctx, result.appid);
  } catch (error) {
    ctx.log(
      `[games] ProtonDB search lookup failed for ${result.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const fallback = existingSummary(existing);
  const resolved = summary ?? fallback ?? {
    tier: 'pending' as ProtonTier,
    trendingTier: null,
    bestTier: null,
    score: null,
    confidence: null,
    total: null,
  };

  await upsertGame(
    ctx.db,
    {
      appid: result.appid,
      name: result.name,
      headerImage:
        result.image ?? (existing?.header_image == null ? null : String(existing.header_image)),
      storeUrl: result.storeUrl,
      tier: resolved.tier,
      trendingTier: resolved.trendingTier,
      bestTier: resolved.bestTier,
      score: resolved.score,
      confidence: resolved.confidence,
      reports: resolved.total,
      isNative: result.platforms.linux,
      featured: Boolean(existing?.featured),
      releaseDate: existing?.release_date == null ? null : String(existing.release_date),
      fetchedAt: summary ? now : Number(existing?.fetched_at ?? now),
    },
    now,
  );
}

export async function searchGames(
  ctx: SyncContext,
  query: string,
): Promise<{ appids: number[]; remote: boolean }> {
  const now = ctx.now();
  const local = await queryGames(ctx.db, {
    q: query,
    limit: 8,
    offset: 0,
  });
  const cacheKey = `steam-search:${nameKey(query)}`;
  let remoteResults = await getSearchCache<SteamSearchResult[]>(
    ctx.db,
    cacheKey,
    SEARCH_CACHE_SECONDS,
  );
  let remote = remoteResults != null;

  if (!remoteResults) {
    try {
      remoteResults = await fetchSteamSearch(ctx, query);
      remote = true;
      await setSearchCache(ctx.db, cacheKey, remoteResults, now);
    } catch (error) {
      ctx.log(
        `[games] Steam search failed for "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      remoteResults = [];
    }
  }

  await mapLimit(remoteResults.slice(0, 6), 2, (result) => buildSearchGame(ctx, result, now));
  await applyAwaToGames(ctx.db);

  const appids = [
    ...local.items.map((game) => game.appid),
    ...remoteResults.slice(0, 6).map((result) => result.appid),
  ];
  return { appids: [...new Set(appids)], remote };
}

export async function lookupGame(ctx: SyncContext, appid: number): Promise<boolean> {
  const now = ctx.now();
  const existing = await getGameRow(ctx.db, appid);
  if (isFresh(existing, now, ctx.config.gamesRefreshHours)) return false;

  let summary: ProtonDbSummary | null = null;
  try {
    summary = await fetchProtonDbSummary(ctx, appid);
  } catch (error) {
    ctx.log(
      `[games] ProtonDB lookup failed for ${appid}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let details = null;
  if (!existing) {
    try {
      details = await fetchSteamAppDetails(ctx, appid);
    } catch (error) {
      ctx.log(
        `[games] Steam details failed for ${appid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const awa = existing ? null : await getAnticheatForName(ctx.db, appid, '');
  if (!existing && !details && !awa && !summary) {
    return false;
  }
  const fallback = existingSummary(existing);
  const resolved = summary ?? fallback ?? {
    tier: 'pending' as ProtonTier,
    trendingTier: null,
    bestTier: null,
    score: null,
    confidence: null,
    total: null,
  };
  const name = details?.name ?? (existing?.name == null ? null : String(existing.name)) ?? awa?.name ?? `Steam App ${appid}`;

  await upsertGame(
    ctx.db,
    {
      appid,
      name,
      headerImage:
        details?.headerImage ??
        (existing?.header_image == null ? null : String(existing.header_image)),
      storeUrl: details?.storeUrl ?? `https://store.steampowered.com/app/${appid}/`,
      tier: resolved.tier,
      trendingTier: resolved.trendingTier,
      bestTier: resolved.bestTier,
      score: resolved.score,
      confidence: resolved.confidence,
      reports: resolved.total,
      isNative: details?.isNative ?? Boolean(existing?.is_native),
      featured: Boolean(existing?.featured),
      releaseDate:
        details?.releaseDate ??
        (existing?.release_date == null ? null : String(existing.release_date)),
      fetchedAt: summary || details ? now : Number(existing?.fetched_at ?? now),
    },
    now,
  );
  await applyAwaToGames(ctx.db);
  return true;
}

export async function syncAwa(ctx: SyncContext): Promise<{ games: number; changed: number }> {
  const source = ctx.config.sources.find((candidate) => candidate.id === 'awa');
  if (!source) throw new Error('AWA source is not configured');
  const now = ctx.now();
  const games = await fetchAwaGames(ctx, source);
  const result = await upsertAwaGames(ctx.db, games, now);
  await setMeta(ctx.db, 'last_awa_sync_at', String(now));
  ctx.broadcast('awa_update', {
    games: games.length,
    changed: result.changed,
    timestamp: now * 1000,
  });
  return { games: games.length, changed: result.changed };
}

export async function ensureGameDetail(ctx: SyncContext, appid: number) {
  const existing = await getGameDetail(ctx.db, appid);
  if (existing) return existing;
  const found = await lookupGame(ctx, appid);
  if (!found) return null;
  return getGameDetail(ctx.db, appid);
}

export async function getGameMeta(ctx: SyncContext, key: string): Promise<number | null> {
  const value = await getMeta(ctx.db, key);
  return value == null ? null : Number(value);
}
