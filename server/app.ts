import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import type { Client } from '@libsql/client';
import type { AppConfig } from './types';
import type { HttpClient } from './lib/http';
import type { SyncContext } from './services/context';
import { createGameMatcher } from './lib/classify';
import { nowSeconds } from './lib/time';
import { createEventHub, type EventHub } from './services/events';
import { createSyncManager, type SyncManager } from './services/sync';
import { createScheduler, type Scheduler } from './services/scheduler';
import { registerEventRoutes } from './routes/events';
import { registerFeedRoutes } from './routes/feed';
import { registerGameRoutes } from './routes/games';
import { registerMetaRoutes } from './routes/meta';
import { registerRefreshRoutes } from './routes/refresh';
import { registerReleaseRoutes } from './routes/releases';
import { syncSourceDefinitions } from './db/repository';

export interface CreateAppOptions {
  config: AppConfig;
  db: Client;
  http: HttpClient;
  now?: () => number;
  serveFrontend?: boolean;
  startScheduler?: boolean;
  logger?: boolean;
}

export interface PulseApp {
  app: FastifyInstance;
  ctx: SyncContext;
  hub: EventHub;
  manager: SyncManager;
  scheduler: Scheduler;
}

export async function createApp(options: CreateAppOptions): Promise<PulseApp> {
  const { config, db, http } = options;
  const app = Fastify({
    logger: options.logger ? { level: 'info' } : false,
    bodyLimit: 256 * 1024,
  });

  await syncSourceDefinitions(db, config.sources);

  const hub = createEventHub();
  const ctx: SyncContext = {
    db,
    config,
    http,
    matcher: createGameMatcher([]),
    now: options.now ?? nowSeconds,
    broadcast: hub.broadcast,
    log: (message) => console.log(message),
  };
  const manager = createSyncManager(ctx, hub);
  const scheduler = createScheduler(config, manager);

  await app.register(fastifyCors, {
    origin: config.isProduction
      ? false
      : ['http://localhost:5174', 'http://127.0.0.1:5174'],
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (reply.raw.headersSent) return payload;
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (request.url.startsWith('/api/') && !reply.getHeader('Cache-Control')) {
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });

  registerFeedRoutes(app, ctx);
  registerReleaseRoutes(app, ctx);
  registerGameRoutes(app, ctx);
  registerMetaRoutes(app, ctx, manager, scheduler);
  registerEventRoutes(app, hub);
  registerRefreshRoutes(app, manager);

  const frontendDist = path.resolve(process.cwd(), 'dist/frontend');
  const serveFrontend = options.serveFrontend ?? true;
  const hasFrontend = serveFrontend && fs.existsSync(path.join(frontendDist, 'index.html'));

  if (hasFrontend) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      index: ['index.html'],
    });
    app.addHook('onSend', async (request, reply, payload) => {
      if (reply.raw.headersSent) return payload;
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://*.steamstatic.com https://*.steampowered.com",
        "connect-src 'self'",
        "font-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ');
      reply.header('Content-Security-Policy', csp);
      return payload;
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    if (hasFrontend) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });

  app.setErrorHandler((error, _request, reply) => {
    console.error('[server] request failed:', error);
    if (reply.sent) return;
    const err = error as { statusCode?: number; message?: string };
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({
      error: status >= 500 ? 'Internal server error' : err.message,
    });
  });

  app.addHook('onClose', async () => {
    hub.stopHeartbeat();
    scheduler.stop();
  });

  hub.startHeartbeat();
  if (options.startScheduler && !config.disableScheduler) {
    scheduler.start();
  }

  return { app, ctx, hub, manager, scheduler };
}
