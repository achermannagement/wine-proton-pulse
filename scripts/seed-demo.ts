import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../server/config';
import { closeDb, configureDb, openDb } from '../server/db/connection';
import { runMigrations } from '../server/db/migrations';
import { createHttpClient } from '../server/lib/http';
import { createApp } from '../server/app';
import { createFixtureHttpClient } from '../server/test/fixtures/fixture-http';
import { getFeedCounts, getStatsCounts, listSources } from '../server/db/repository';
import { applyDemoCompatibilityExtras } from './seed-extras';

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main(): Promise<void> {
  const fixtures = !process.argv.includes('--live');
  const dataDir = argValue('--data-dir') ?? (fixtures ? '.tmp/demo-data' : 'data');
  const reset = process.argv.includes('--reset');
  const config = loadConfig({ dataDir, disableScheduler: true });

  if (reset) {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${config.dbPath}${suffix}`, { force: true });
    }
  }

  const db = openDb(config.dbPath);
  await configureDb(db);
  await runMigrations(db);

  const http = fixtures
    ? createFixtureHttpClient()
    : createHttpClient({
        timeoutMs: config.httpTimeoutMs,
        userAgent: config.userAgent,
        githubToken: config.githubToken,
      });

  const pulse = await createApp({
    config,
    db,
    http,
    serveFrontend: false,
    startScheduler: false,
  });

  console.log(
    `[seed] ${fixtures ? 'fixtures' : 'live sources'} → ${config.dbPath}`,
  );
  const result = await pulse.manager.run('seed');
  if (fixtures) await applyDemoCompatibilityExtras(db);
  console.log(JSON.stringify(result, null, 2));
  console.log('[seed] counts', await getStatsCounts(db));
  console.log('[seed] feed', await getFeedCounts(db));
  console.log('[seed] sources', (await listSources(db)).map((source) => ({
    id: source.id,
    items: source.itemCount,
    lastError: source.lastError,
  })));

  await pulse.app.close();
  await closeDb(db);
  const relativeDataDir = path.relative(process.cwd(), dataDir) || '.';
  console.log(
    fixtures
      ? `[seed] done. Start with DISABLE_SCHEDULER=1 DATA_DIR=${relativeDataDir} npm start`
      : `[seed] done. Start with DATA_DIR=${relativeDataDir} npm start`,
  );
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
