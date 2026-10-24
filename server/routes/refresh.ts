import type { FastifyInstance } from 'fastify';
import type { SyncManager } from '../services/sync';

export function registerRefreshRoutes(app: FastifyInstance, manager: SyncManager): void {
  app.post('/api/refresh', async (_request, reply) => {
    const result = manager.requestManual();
    if (!result.started) {
      if (result.reason === 'cooldown' && result.retryAfterMs != null) {
        reply.header('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
        return reply.code(429).send(result);
      }
      return reply.code(202).send(result);
    }
    return reply.code(202).send(result);
  });
}
