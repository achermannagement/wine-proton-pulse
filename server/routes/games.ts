import type { FastifyInstance } from 'fastify';
import type { SyncContext } from '../services/context';
import {
  queryCompatEvents,
  queryGames,
} from '../db/repository';
import { ensureGameDetail, searchGames } from '../services/games';
import { queryAppIds, queryBool, queryEnum, queryInt, queryString, queryTier } from '../lib/query';

export function registerGameRoutes(app: FastifyInstance, ctx: SyncContext): void {
  app.get('/api/games', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const q = queryString(query.q, 120);
    const tier = queryTier(query.tier);
    const sort = queryEnum(query.sort, ['recent', 'tier', 'name', 'reports', 'score'] as const, 'recent');
    const featured = queryBool(query.featured);
    const appids = queryAppIds(query.appids);
    const limit = queryInt(query.limit, 40, 1, 100);
    const offset = queryInt(query.offset, 0, 0, 100_000);

    const result = await queryGames(ctx.db, {
      q,
      tier,
      sort,
      featured,
      appids: appids.length > 0 ? appids : null,
      limit,
      offset,
    });
    reply.header('Cache-Control', 'no-store');
    return result;
  });

  app.get('/api/games/search', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const q = queryString(query.q, 120);
    if (!q || q.length < 2) {
      return reply.code(400).send({ error: 'Search query must be at least 2 characters' });
    }
    const result = await searchGames(ctx, q);
    const games = await queryGames(ctx.db, {
      appids: result.appids,
      limit: 30,
      offset: 0,
    });
    const order = new Map(result.appids.map((appid, index) => [appid, index]));
    const items = [...games.items].sort(
      (left, right) =>
        (order.get(left.appid) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.appid) ?? Number.MAX_SAFE_INTEGER),
    );
    reply.header('Cache-Control', 'no-store');
    return { items, query: q, remote: result.remote };
  });

  app.get('/api/games/:appid', async (request, reply) => {
    const { appid: rawAppid } = request.params as { appid: string };
    const appid = Number(rawAppid);
    if (!Number.isInteger(appid) || appid <= 0) {
      return reply.code(400).send({ error: 'Invalid app id' });
    }
    const detail = await ensureGameDetail(ctx, appid);
    if (!detail) return reply.code(404).send({ error: 'Game not found' });
    reply.header('Cache-Control', 'no-store');
    return detail;
  });

  app.get('/api/compat/events', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const limit = queryInt(query.limit, 20, 1, 100);
    const events = await queryCompatEvents(ctx.db, limit);
    reply.header('Cache-Control', 'no-store');
    return { items: events };
  });
}
