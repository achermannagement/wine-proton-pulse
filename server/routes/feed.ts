import type { FastifyInstance } from 'fastify';
import type { SyncContext } from '../services/context';
import { getLatestNewsUpdate, getMeta, getNewsItem, queryFeed } from '../db/repository';
import { queryCategory, queryInt, queryRange, queryString } from '../lib/query';

export function registerFeedRoutes(app: FastifyInstance, ctx: SyncContext): void {
  app.get('/api/feed', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const limit = queryInt(query.limit, 30, 1, 60);
    const offset = queryInt(query.offset, 0, 0, 100_000);
    const q = queryString(query.q, 120);
    const source = queryString(query.source, 60);
    const game = queryInt(query.game, 0, 0, Number.MAX_SAFE_INTEGER) || null;
    const lastSync = await getMeta(ctx.db, 'last_sync_at');
    const lastUpdated = lastSync ? Number(lastSync) : await getLatestNewsUpdate(ctx.db);

    const result = await queryFeed(
      ctx.db,
      {
        category: queryCategory(query.category),
        source,
        q,
        range: queryRange(query.range),
        game,
        limit,
        offset,
      },
      lastUpdated,
    );
    reply.header('Cache-Control', 'no-store');
    return result;
  });

  app.get('/api/feed/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await getNewsItem(ctx.db, id);
    if (!item) return reply.code(404).send({ error: 'Not found' });
    reply.header('Cache-Control', 'no-store');
    return item;
  });
}
