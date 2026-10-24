import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../server/config';
import { configureDb, openDb } from '../server/db/connection';
import { runMigrations } from '../server/db/migrations';
import { createApp } from '../server/app';
import { createFixtureHttpClient } from '../server/test/fixtures/fixture-http';
import { applyDemoCompatibilityExtras } from './seed-extras';

async function main(): Promise<void> {
  const dataDir = path.resolve(process.cwd(), '.tmp/e2e-data');
  fs.rmSync(dataDir, { recursive: true, force: true });

  const config = loadConfig({
    dataDir,
    port: 4321,
    host: '127.0.0.1',
    disableScheduler: true,
    isProduction: true,
    manualRefreshCooldownSeconds: 2,
  });

  const db = openDb(config.dbPath);
  await configureDb(db);
  await runMigrations(db);

  const http = createFixtureHttpClient();
  const pulse = await createApp({
    config,
    db,
    http,
    serveFrontend: true,
    startScheduler: false,
    logger: false,
  });

  console.log('[e2e] seeding deterministic fixture data');
  const result = await pulse.manager.run('e2e-seed');
  await applyDemoCompatibilityExtras(db);
  console.log(
    `[e2e] seeded ${result.news.new} news items, ${result.games?.games ?? 0} games`,
  );

  await pulse.app.listen({ port: config.port, host: config.host });
  console.log(`[e2e] listening on http://${config.host}:${config.port}`);

  const shutdown = async (): Promise<void> => {
    await pulse.app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('[e2e] failed:', error);
  process.exit(1);
});
