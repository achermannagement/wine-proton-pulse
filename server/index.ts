import dns from 'node:dns';
import { loadConfig } from './config';
import { closeDb, configureDb, openDb } from './db/connection';
import { runMigrations } from './db/migrations';
import { createHttpClient } from './lib/http';
import { createApp } from './app';

dns.setDefaultResultOrder('ipv4first');

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.dbPath);
  await configureDb(db);
  await runMigrations(db);

  const http = createHttpClient({
    timeoutMs: config.httpTimeoutMs,
    userAgent: config.userAgent,
    githubToken: config.githubToken,
  });

  const { app, scheduler } = await createApp({
    config,
    db,
    http,
    serveFrontend: true,
    startScheduler: !config.disableScheduler,
    logger: config.isProduction,
  });

  await app.listen({ port: config.port, host: config.host });
  console.log(`[server] Wine & Proton Pulse listening on http://${config.host}:${config.port}`);
  console.log(
    `[server] data: ${config.dbPath} · refresh: ${config.newsRefreshMinutes}m · scheduler: ${
      config.disableScheduler ? 'disabled' : 'enabled'
    }`,
  );

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);
    scheduler.stop();
    try {
      await app.close();
    } finally {
      await closeDb(db);
      process.exit(0);
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});
