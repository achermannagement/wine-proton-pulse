import type { FastifyInstance } from 'fastify';
import type { SyncContext } from '../services/context';
import { getLatestNewsUpdate, getMeta, queryReleases } from '../db/repository';

export function registerReleaseRoutes(app: FastifyInstance, ctx: SyncContext): void {
  app.get('/api/releases', async (_request, reply) => {
    const lastSync = await getMeta(ctx.db, 'last_sync_at');
    const lastUpdated = lastSync ? Number(lastSync) : await getLatestNewsUpdate(ctx.db);
    const result = await queryReleases(ctx.db, lastUpdated, 3, 24);
    reply.header('Cache-Control', 'no-store');
    return result;
  });
}
