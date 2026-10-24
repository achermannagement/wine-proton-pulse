import type { NewsItemInput, SourceConfig } from '../types';
import type { SyncContext } from './context';
import type { EventHub } from './events';
import {
  getGazetteer,
  getMeta,
  getSourceItemsFound,
  getSourceLastSuccess,
  insertFetchLog,
  pruneOldData,
  setMeta,
  syncSourceDefinitions,
  updateSourceFailure,
  updateSourceSuccess,
  upsertNewsItems,
} from '../db/repository';
import { createGameMatcher } from '../lib/classify';
import { sleep } from '../lib/http';
import { isOlderThan } from '../lib/time';
import { fetchGithubSource } from '../sources/github';
import { fetchRssSource } from '../sources/rss';
import { fetchWineSource } from '../sources/wine';
import { syncAwa, syncFeaturedGames } from './games';

export interface SyncSourceResult {
  id: string;
  ok: boolean;
  itemsFound: number;
  itemsNew: number;
  error?: string;
  durationMs: number;
}

export interface SyncResult {
  reason: string;
  startedAt: number;
  durationMs: number;
  news: { found: number; new: number };
  games?: { games: number; tierChanges: number; failed: number; steamFailed: boolean };
  awa?: { games: number; changed: number };
  sources: SyncSourceResult[];
}

export interface SyncManager {
  run(reason: string): Promise<SyncResult>;
  requestManual(): { started: boolean; reason?: string; retryAfterMs?: number };
  isRunning(): boolean;
  getLastManualAt(): number | null;
  getLastResult(): SyncResult | null;
}

async function syncNewsSource(
  ctx: SyncContext,
  source: SourceConfig,
): Promise<SyncSourceResult> {
  const startedAt = ctx.now();
  const start = Date.now();
  let items: NewsItemInput[] = [];
  try {
    switch (source.kind) {
      case 'gitlab-releases':
        items = await fetchWineSource(ctx, source);
        break;
      case 'github-releases':
        items = await fetchGithubSource(ctx, source);
        break;
      case 'rss':
      case 'reddit':
        items = await fetchRssSource(ctx, source);
        break;
      default:
        return {
          id: source.id,
          ok: true,
          itemsFound: 0,
          itemsNew: 0,
          durationMs: 0,
        };
    }

    const result = await upsertNewsItems(ctx.db, items, ctx.now());
    const durationMs = Date.now() - start;
    const healthItemsFound =
      items.length > 0 ? items.length : await getSourceItemsFound(ctx.db, source.id);
    await updateSourceSuccess(ctx.db, source.id, {
      attemptedAt: startedAt,
      durationMs,
      itemsFound: healthItemsFound,
      itemsNew: result.inserted,
    });
    await insertFetchLog(ctx.db, {
      source: source.id,
      startedAt,
      durationMs,
      itemsFound: items.length,
      itemsNew: result.inserted,
    });
    if (result.inserted > 0) {
      ctx.broadcast('news_update', {
        source: source.id,
        inserted: result.inserted,
        total: items.length,
        timestamp: Date.now(),
      });
    }
    return {
      id: source.id,
      ok: true,
      itemsFound: items.length,
      itemsNew: result.inserted,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    await updateSourceFailure(ctx.db, source.id, {
      attemptedAt: startedAt,
      durationMs,
      error: message,
    });
    await insertFetchLog(ctx.db, {
      source: source.id,
      startedAt,
      durationMs,
      itemsFound: 0,
      itemsNew: 0,
      error: message,
    });
    ctx.log(`[sync] ${source.name} failed: ${message}`);
    return {
      id: source.id,
      ok: false,
      itemsFound: 0,
      itemsNew: 0,
      error: message,
      durationMs,
    };
  }
}

async function executeSync(
  ctx: SyncContext,
  hub: EventHub,
  reason: string,
): Promise<SyncResult> {
  const startedAt = ctx.now();
  const start = Date.now();
  const sources: SyncSourceResult[] = [];
  let awaResult: SyncResult['awa'];
  let gamesResult: SyncResult['games'];

  await syncSourceDefinitions(ctx.db, ctx.config.sources);

  const awaLastSuccess = await getSourceLastSuccess(ctx.db, 'awa');
  if (isOlderThan(awaLastSuccess, startedAt, ctx.config.awaRefreshHours)) {
    const awaStart = ctx.now();
    const awaTimer = Date.now();
    try {
      awaResult = await syncAwa(ctx);
      const durationMs = Date.now() - awaTimer;
      await updateSourceSuccess(ctx.db, 'awa', {
        attemptedAt: awaStart,
        durationMs,
        itemsFound: awaResult.games,
        itemsNew: 0,
      });
      sources.push({
        id: 'awa',
        ok: true,
        itemsFound: awaResult.games,
        itemsNew: awaResult.changed,
        durationMs,
      });
    } catch (error) {
      const durationMs = Date.now() - awaTimer;
      const message = error instanceof Error ? error.message : String(error);
      await updateSourceFailure(ctx.db, 'awa', {
        attemptedAt: awaStart,
        durationMs,
        error: message,
      });
      ctx.log(`[sync] AWA failed: ${message}`);
      sources.push({
        id: 'awa',
        ok: false,
        itemsFound: 0,
        itemsNew: 0,
        error: message,
        durationMs,
      });
    }
  }

  ctx.matcher = createGameMatcher(await getGazetteer(ctx.db));

  const newsSources = ctx.config.sources.filter(
    (source) =>
      source.enabled &&
      (source.kind === 'gitlab-releases' ||
        source.kind === 'github-releases' ||
        source.kind === 'rss' ||
        source.kind === 'reddit'),
  );

  for (const source of newsSources) {
    sources.push(await syncNewsSource(ctx, source));
    await sleep(250);
  }

  const lastGamesSyncValue = await getMeta(ctx.db, 'last_games_sync_at');
  const lastGamesSync = lastGamesSyncValue == null ? null : Number(lastGamesSyncValue);
  if (isOlderThan(lastGamesSync, startedAt, ctx.config.gamesRefreshHours)) {
    const gamesStart = ctx.now();
    const timer = Date.now();
    try {
      gamesResult = await syncFeaturedGames(ctx);
      const durationMs = Date.now() - timer;
      if (gamesResult.steamFailed) {
        await updateSourceFailure(ctx.db, 'steam', {
          attemptedAt: gamesStart,
          durationMs,
          error: 'Steam featured categories unavailable; popular compatibility shelf used',
        });
        sources.push({
          id: 'steam',
          ok: false,
          itemsFound: 0,
          itemsNew: 0,
          error: 'Steam featured categories unavailable',
          durationMs,
        });
      } else {
        await updateSourceSuccess(ctx.db, 'steam', {
          attemptedAt: gamesStart,
          durationMs,
          itemsFound: gamesResult.games,
          itemsNew: 0,
        });
        sources.push({
          id: 'steam',
          ok: true,
          itemsFound: gamesResult.games,
          itemsNew: 0,
          durationMs,
        });
      }
      if (gamesResult.games > 0 && gamesResult.failed === gamesResult.games) {
        await updateSourceFailure(ctx.db, 'protondb', {
          attemptedAt: gamesStart,
          durationMs,
          error: 'All ProtonDB lookups failed',
        });
        sources.push({
          id: 'protondb',
          ok: false,
          itemsFound: 0,
          itemsNew: 0,
          error: 'All ProtonDB lookups failed',
          durationMs,
        });
      } else {
        await updateSourceSuccess(ctx.db, 'protondb', {
          attemptedAt: gamesStart,
          durationMs,
          itemsFound: gamesResult.games - gamesResult.failed,
          itemsNew: gamesResult.tierChanges,
        });
        sources.push({
          id: 'protondb',
          ok: true,
          itemsFound: gamesResult.games - gamesResult.failed,
          itemsNew: gamesResult.tierChanges,
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - timer;
      const message = error instanceof Error ? error.message : String(error);
      await updateSourceFailure(ctx.db, 'steam', {
        attemptedAt: gamesStart,
        durationMs,
        error: message,
      });
      await updateSourceFailure(ctx.db, 'protondb', {
        attemptedAt: gamesStart,
        durationMs,
        error: message,
      });
      ctx.log(`[sync] games failed: ${message}`);
      sources.push({
        id: 'steam',
        ok: false,
        itemsFound: 0,
        itemsNew: 0,
        error: message,
        durationMs,
      });
    }
  }

  const newsFound = sources
    .filter((source) => !['awa', 'steam', 'protondb'].includes(source.id))
    .reduce((sum, source) => sum + source.itemsFound, 0);
  const newsNew = sources
    .filter((source) => !['awa', 'steam', 'protondb'].includes(source.id))
    .reduce((sum, source) => sum + source.itemsNew, 0);

  const result: SyncResult = {
    reason,
    startedAt,
    durationMs: Date.now() - start,
    news: { found: newsFound, new: newsNew },
    games: gamesResult,
    awa: awaResult,
    sources,
  };

  await setMeta(ctx.db, 'last_sync_at', String(ctx.now()));
  await setMeta(ctx.db, 'last_sync_summary', JSON.stringify(result));
  await pruneOldData(ctx.db, ctx.now());

  hub.broadcast('fetch_complete', {
    reason,
    durationMs: result.durationMs,
    news: result.news,
    games: result.games,
    awa: result.awa,
    timestamp: Date.now(),
  });

  ctx.log(
    `[sync] ${reason} complete in ${result.durationMs}ms — ${newsNew} new news, ${
      gamesResult?.games ?? 0
    } games`,
  );

  return result;
}

export function createSyncManager(ctx: SyncContext, hub: EventHub): SyncManager {
  let running: Promise<SyncResult> | null = null;
  let lastManualAt: number | null = null;
  let lastResult: SyncResult | null = null;

  async function run(reason: string): Promise<SyncResult> {
    if (running) return running;
    running = executeSync(ctx, hub, reason)
      .then((result) => {
        lastResult = result;
        return result;
      })
      .catch((error) => {
        hub.broadcast('fetch_error', {
          reason,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        throw error;
      })
      .finally(() => {
        running = null;
      });
    return running;
  }

  return {
    run,
    requestManual() {
      if (running) return { started: false, reason: 'running' };
      const now = Date.now();
      if (
        lastManualAt != null &&
        now - lastManualAt < ctx.config.manualRefreshCooldownSeconds * 1000
      ) {
        return {
          started: false,
          reason: 'cooldown',
          retryAfterMs: ctx.config.manualRefreshCooldownSeconds * 1000 - (now - lastManualAt),
        };
      }
      lastManualAt = now;
      void run('manual').catch((error) => {
        ctx.log(`[sync] manual refresh failed: ${String(error)}`);
      });
      return { started: true };
    },
    isRunning() {
      return running != null;
    },
    getLastManualAt() {
      return lastManualAt;
    },
    getLastResult() {
      return lastResult;
    },
  };
}
