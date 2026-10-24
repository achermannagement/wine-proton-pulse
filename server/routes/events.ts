import type { FastifyInstance } from 'fastify';
import type { EventHub } from '../services/events';

export function registerEventRoutes(app: FastifyInstance, hub: EventHub): void {
  app.get('/api/events', (request, reply) => {
    reply.header('Cache-Control', 'no-cache, no-transform');
    hub.addClient(reply);
    return reply;
  });
}
