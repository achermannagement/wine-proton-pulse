import type { FastifyInstance } from 'fastify';
import type { StatsDto } from '../../shared/types';
import type { SyncContext } from '../services/context';
import type { Scheduler } from '../services/scheduler';
import type { SyncManager } from '../services/sync';
import {
  getFeedCounts,
  getLatestNewsUpdate,
  getMeta,
  getStatsCounts,
  listSources,
  queryCompatEvents,
  queryReleases,
} from '../db/repository';

export function registerMetaRoutes(
  app: FastifyInstance,
  ctx: SyncContext,
  manager: SyncManager,
  scheduler: Scheduler,
): void {
  app.get('/api/sources', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { items: await listSources(ctx.db) };
  });

  app.get('/api/stats', async (_request, reply) => {
    const sources = await listSources(ctx.db);
    const counts = await getStatsCounts(ctx.db);
    const feedCounts = await getFeedCounts(ctx.db);
    const lastSync = await getMeta(ctx.db, 'last_sync_at');
    const lastUpdated = lastSync ? Number(lastSync) : await getLatestNewsUpdate(ctx.db);
    const releases = await queryReleases(ctx.db, lastUpdated, 1, 8);
    const pulse = await queryCompatEvents(ctx.db, 8);
    const enabledSources = sources.filter((source) => source.enabled);
    const healthy = enabledSources.filter(
      (source) => source.lastError == null && source.lastSuccessAt != null,
    ).length;

    const stats: StatsDto = {
      lastUpdated,
      nextRefreshAt: scheduler.getNextRunAt(),
      syncRunning: manager.isRunning(),
      counts: {
        ...counts,
        sourcesHealthy: healthy,
        sourcesTotal: enabledSources.length,
      },
      feedCounts,
      sources,
      pulse,
      latestReleases: releases.latest,
    };
    reply.header('Cache-Control', 'no-store');
    return stats;
  });

  app.get('/api/health', async (_request, reply) => {
    await ctx.db.execute('SELECT 1');
    reply.header('Cache-Control', 'no-store');
    return {
      status: 'ok',
      time: new Date().toISOString(),
      syncRunning: manager.isRunning(),
    };
  });
}
