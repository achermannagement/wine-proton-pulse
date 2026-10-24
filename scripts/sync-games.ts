import { loadConfig } from '../server/config';
import { closeDb, configureDb, openDb } from '../server/db/connection';
import { runMigrations } from '../server/db/migrations';
import { createHttpClient } from '../server/lib/http';
import { createApp } from '../server/app';
import { syncFeaturedGames } from '../server/services/games';
import { updateSourceFailure, updateSourceSuccess } from '../server/db/repository';
import { nowSeconds } from '../server/lib/time';

async function main(): Promise<void> {
  const config = loadConfig({ disableScheduler: true });
  const db = openDb(config.dbPath);
  await configureDb(db);
  await runMigrations(db);
  const http = createHttpClient({
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
  const started = nowSeconds();
  const start = Date.now();
  const result = await syncFeaturedGames(pulse.ctx);
  const durationMs = Date.now() - start;
  if (result.steamFailed) {
    await updateSourceFailure(db, 'steam', {
      attemptedAt: started,
      durationMs,
      error: 'Steam featured categories unavailable; popular compatibility shelf used',
    });
  } else {
    await updateSourceSuccess(db, 'steam', {
      attemptedAt: started,
      durationMs,
      itemsFound: result.games,
      itemsNew: 0,
    });
  }
  if (result.games > 0 && result.failed === result.games) {
    await updateSourceFailure(db, 'protondb', {
      attemptedAt: started,
      durationMs,
      error: 'All ProtonDB lookups failed',
    });
  } else {
    await updateSourceSuccess(db, 'protondb', {
      attemptedAt: started,
      durationMs,
      itemsFound: result.games - result.failed,
      itemsNew: result.tierChanges,
    });
  }
  console.log('[sync-games]', result);
  await pulse.app.close();
  await closeDb(db);
}

main().catch((error) => {
  console.error('[sync-games] failed:', error);
  process.exit(1);
});
