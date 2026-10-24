import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { createApp, type PulseApp } from './app';
import {
  createFixtureHttpClient,
  createTestDb,
  type TestDatabase,
} from './test/helpers';
import { applyDemoCompatibilityExtras } from '../scripts/seed-extras';
import { getStatsCounts, listSources } from './db/repository';
import type { HttpClient } from './lib/http';

let testDb: TestDatabase;
let pulse: PulseApp;

beforeAll(async () => {
  testDb = await createTestDb();
  const config = loadConfig({
    dataDir: testDb.dir,
    disableScheduler: true,
    manualRefreshCooldownSeconds: 60,
    isProduction: false,
  });
  pulse = await createApp({
    config,
    db: testDb.db,
    http: createFixtureHttpClient(),
    serveFrontend: false,
    startScheduler: false,
  });
  await pulse.manager.run('test-seed');
  await applyDemoCompatibilityExtras(testDb.db);
});

afterAll(async () => {
  if (pulse) await pulse.app.close();
  if (testDb) await testDb.cleanup();
});

async function getJson<T>(url: string): Promise<T> {
  const response = await pulse.app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  return response.json() as T;
}

describe('API: meta and stats', () => {
  it('reports health', async () => {
    const body = await getJson<{ status: string; syncRunning: boolean }>('/api/health');
    expect(body.status).toBe('ok');
    expect(body.syncRunning).toBe(false);
  });

  it('returns aggregate stats, source health and the compatibility pulse', async () => {
    const stats = await getJson<{
      lastUpdated: number;
      counts: {
        news: number;
        releases: number;
        games: number;
        compatEvents: number;
        sourcesHealthy: number;
        sourcesTotal: number;
      };
      sources: unknown[];
      pulse: { gameName: string }[];
      latestReleases: { title: string }[];
      feedCounts: { all: number };
    }>('/api/stats');

    expect(stats.lastUpdated).toBeGreaterThan(0);
    expect(stats.counts.news).toBeGreaterThan(30);
    expect(stats.counts.releases).toBeGreaterThanOrEqual(8);
    expect(stats.counts.games).toBe(25);
    expect(stats.counts.compatEvents).toBeGreaterThanOrEqual(3);
    expect(stats.counts.sourcesHealthy).toBe(stats.counts.sourcesTotal);
    expect(stats.sources).toHaveLength(12);
    expect(stats.pulse.map((event) => event.gameName)).toContain('HELLDIVERS™ 2');
    expect(stats.latestReleases.length).toBeGreaterThanOrEqual(5);
    expect(stats.feedCounts.all).toBe(stats.counts.news);
  });

  it('lists all sources', async () => {
    const body = await getJson<{ items: { id: string; lastSuccessAt: number | null }[] }>(
      '/api/sources',
    );
    expect(body.items).toHaveLength(12);
    expect(body.items.every((source) => source.lastSuccessAt != null)).toBe(true);
  });
});

describe('API: feed', () => {
  it('returns paginated news and global counts', async () => {
    const body = await getJson<{
      items: { id: string; url: string; categories: string[] }[];
      total: number;
      counts: { all: number; gamefixes: number };
      hasMore: boolean;
      lastUpdated: number;
    }>('/api/feed?limit=5');

    expect(body.items).toHaveLength(5);
    expect(body.total).toBeGreaterThan(30);
    expect(body.counts.all).toBe(body.total);
    expect(body.counts.gamefixes).toBeGreaterThan(0);
    expect(body.hasMore).toBe(true);
    expect(body.lastUpdated).toBeGreaterThan(0);
    expect(body.items[0]?.url).toMatch(/^https?:\/\//);
  });

  it('filters game fixes to bugfix + compatibility entries', async () => {
    const body = await getJson<{
      items: { flags: { bugfix: boolean; compat: boolean; discussion: boolean } }[];
    }>('/api/feed?category=gamefix&limit=60');

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.flags.bugfix && item.flags.compat)).toBe(true);
    expect(body.items.every((item) => !item.flags.discussion)).toBe(true);
  });

  it('filters by source', async () => {
    const body = await getJson<{
      items: { sourceId: string; kind: string; flags: { discussion: boolean } }[];
    }>('/api/feed?source=reddit&limit=60');
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.sourceId === 'reddit')).toBe(true);
    expect(body.items.every((item) => item.kind === 'discussion')).toBe(true);
    expect(body.items.every((item) => item.flags.discussion)).toBe(true);
  });

  it('filters by release kind and time range', async () => {
    const releases = await getJson<{ items: { kind: string }[] }>(
      '/api/feed?category=release&limit=60',
    );
    expect(releases.items.length).toBeGreaterThanOrEqual(8);
    expect(releases.items.every((item) => item.kind === 'release')).toBe(true);

    const recent = await getJson<{ items: { publishedAt: number | null; discoveredAt: number }[] }>(
      '/api/feed?range=24h&limit=60',
    );
    const cutoff = Math.floor(Date.now() / 1000) - 86_400 - 10;
    expect(recent.items.every((item) => (item.publishedAt ?? item.discoveredAt) >= cutoff)).toBe(
      true,
    );
  });

  it('searches titles, summaries and parsed entries', async () => {
    const body = await getJson<{ items: { title: string; entryCount: number }[] }>(
      '/api/feed?q=Star%20Citizen&limit=60',
    );
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.some(
        (item) =>
          item.title.includes('Star Citizen') ||
          item.entryCount > 0,
      ),
    ).toBe(true);
  });

  it('returns a full item with entries and a 404 for unknown ids', async () => {
    const feed = await getJson<{ items: { id: string }[] }>(
      '/api/feed?source=winehq&limit=1',
    );
    const id = feed.items[0]?.id;
    expect(id).toBeTruthy();
    const item = await getJson<{ title: string; entries: { text: string }[] }>(`/api/feed/${id}`);
    expect(item.title).toContain('Wine');
    expect(item.entries.length).toBeGreaterThan(10);

    const missing = await pulse.app.inject({ method: 'GET', url: '/api/feed/nope' });
    expect(missing.statusCode).toBe(404);
  });
});

describe('API: releases', () => {
  it('returns the latest version per release source', async () => {
    const body = await getJson<{
      latest: { sourceId: string; title: string; entries: unknown[] }[];
      items: { title: string; kind: string }[];
    }>('/api/releases');

    expect(body.latest.length).toBeGreaterThanOrEqual(5);
    expect(new Set(body.latest.map((item) => item.sourceId)).size).toBe(body.latest.length);
    expect(body.items.some((item) => item.title === 'Wine 11.20')).toBe(true);
    expect(body.items.every((item) => item.kind === 'release')).toBe(true);
  });
});

describe('API: games', () => {
  it('returns featured games with compatibility metadata', async () => {
    const body = await getJson<{
      total: number;
      items: {
        appid: number;
        name: string;
        tier: string | null;
        awaStatus: string | null;
        isNative: boolean;
      }[];
    }>('/api/games?featured=1&limit=30');

    expect(body.total).toBe(25);
    expect(body.items).toHaveLength(25);
    expect(body.items.find((game) => game.appid === 1245620)).toMatchObject({
      name: 'ELDEN RING',
      tier: 'gold',
      awaStatus: 'Supported',
    });
    expect(body.items.find((game) => game.appid === 570)?.isNative).toBe(true);
  });

  it('filters by tier', async () => {
    const body = await getJson<{ items: { appid: number; tier: string }[] }>(
      '/api/games?tier=platinum&limit=30',
    );
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((game) => game.tier === 'platinum')).toBe(true);
    expect(body.items.some((game) => game.appid === 730)).toBe(true);
  });

  it('returns a game detail with history, events, anti-cheat and related news', async () => {
    const detail = await getJson<{
      game: { appid: number; tier: string; previousTier: string | null };
      history: { tier: string }[];
      events: { type: string; fromValue: string; toValue: string }[];
      anticheat: { status: string };
      relatedNews: { titles?: string; title: string }[];
    }>('/api/games/553850');

    expect(detail.game).toMatchObject({ appid: 553850, tier: 'gold', previousTier: 'silver' });
    expect(detail.history.length).toBeGreaterThan(10);
    expect(detail.events.some((event) => event.type === 'tier-change')).toBe(true);
    expect(detail.anticheat.status).toBe('Running');
    expect(detail.relatedNews.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown app id', async () => {
    const response = await pulse.app.inject({ method: 'GET', url: '/api/games/999999' });
    expect(response.statusCode).toBe(404);
  });

  it('searches Steam and prioritizes the base game result', async () => {
    const body = await getJson<{
      remote: boolean;
      query: string;
      items: { appid: number; name: string }[];
    }>('/api/games/search?q=elden');
    expect(body.remote).toBe(true);
    expect(body.items[0]).toMatchObject({ appid: 1245620, name: 'ELDEN RING' });
  });
});

describe('API: refresh', () => {
  it('starts a manual sync and reports a running or cooldown state', async () => {
    const database = await createTestDb();
    const config = loadConfig({
      dataDir: database.dir,
      disableScheduler: true,
      manualRefreshCooldownSeconds: 60,
      isProduction: false,
    });
    const app = await createApp({
      config,
      db: database.db,
      http: createFixtureHttpClient(),
      serveFrontend: false,
      startScheduler: false,
    });
    await app.manager.run('prepare');

    const first = await app.app.inject({ method: 'POST', url: '/api/refresh' });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toMatchObject({ started: true });

    const second = await app.app.inject({ method: 'POST', url: '/api/refresh' });
    expect([202, 429]).toContain(second.statusCode);
    const body = second.json() as { started: boolean; reason?: string };
    expect(body.started).toBe(false);
    expect(['running', 'cooldown']).toContain(body.reason);

    if (app.manager.isRunning()) await app.manager.run('wait');
    await app.app.close();
    await database.cleanup();
  });
});

describe('resilience', () => {
  it('keeps cached data when one source fails', async () => {
    const database = await createTestDb();
    const config = loadConfig({
      dataDir: database.dir,
      disableScheduler: true,
      isProduction: false,
    });
    const base = createFixtureHttpClient();
    const http = {
      requests: base.requests,
      getText: (url: string, options?: Parameters<typeof base.getText>[1]) => {
        if (url.includes('gamingonlinux.com')) return Promise.reject(new Error('simulated outage'));
        return base.getText(url, options);
      },
      getJson: base.getJson,
    };
    const app = await createApp({
      config,
      db: database.db,
      http,
      serveFrontend: false,
      startScheduler: false,
    });
    await app.manager.run('failure-test');

    const sources = await listSources(database.db);
    const gol = sources.find((source) => source.id === 'gamingonlinux');
    expect(gol?.lastError).toContain('simulated outage');
    expect(sources.find((source) => source.id === 'winehq')?.lastError).toBeNull();

    const feed = await app.app.inject({ method: 'GET', url: '/api/feed?source=winehq' });
    expect(feed.statusCode).toBe(200);
    expect((feed.json() as { total: number }).total).toBeGreaterThan(0);

    await app.app.close();
    await database.cleanup();
  });

  it('is idempotent across repeated syncs and preserves last found on 304s', async () => {
    const database = await createTestDb();
    const config = loadConfig({
      dataDir: database.dir,
      disableScheduler: true,
      isProduction: false,
    });
    const base = createFixtureHttpClient();
    const app = await createApp({
      config,
      db: database.db,
      http: base,
      serveFrontend: false,
      startScheduler: false,
    });
    await app.manager.run('first');
    const first = await getStatsCounts(database.db);
    const firstEntries = await database.db.execute('SELECT COUNT(*) AS count FROM news_entries');
    const firstSources = await listSources(database.db);
    const protonBefore = firstSources.find((source) => source.id === 'proton')?.itemsFound;

    const cacheHttp: HttpClient = {
      async getJson<T>(url: string, options?: Parameters<HttpClient['getJson']>[1]) {
        if (/api\.github\.com/.test(url)) {
          return { status: 304, notModified: true, data: null, etag: null } as {
            status: number;
            notModified: boolean;
            data: T | null;
            etag: string | null;
          };
        }
        return base.getJson<T>(url, options);
      },
      getText: (url, options) => base.getText(url, options),
    };
    app.ctx.http = cacheHttp;
    await app.manager.run('second');
    const second = await getStatsCounts(database.db);
    const secondEntries = await database.db.execute('SELECT COUNT(*) AS count FROM news_entries');
    const protonAfter = (await listSources(database.db)).find((source) => source.id === 'proton');

    expect(second.news).toBe(first.news);
    expect(Number(secondEntries.rows[0]?.count)).toBe(Number(firstEntries.rows[0]?.count));
    expect(second.games).toBe(first.games);
    expect(protonAfter?.itemsFound).toBe(protonBefore);
    expect(protonAfter?.lastError).toBeNull();

    await app.app.close();
    await database.cleanup();
  });

  it('keeps the popular shelf when Steam featured categories fail', async () => {
    const database = await createTestDb();
    const config = loadConfig({
      dataDir: database.dir,
      disableScheduler: true,
      isProduction: false,
    });
    const base = createFixtureHttpClient();
    const http: HttpClient = {
      getJson<T>(url: string, options?: Parameters<HttpClient['getJson']>[1]) {
        if (url.includes('featuredcategories')) {
          return Promise.reject(new Error('steam featured outage'));
        }
        return base.getJson<T>(url, options);
      },
      getText: (url, options) => base.getText(url, options),
    };
    const app = await createApp({
      config,
      db: database.db,
      http,
      serveFrontend: false,
      startScheduler: false,
    });
    await app.manager.run('steam-failure');
    const sources = await listSources(database.db);
    const steam = sources.find((source) => source.id === 'steam');
    expect(steam?.lastError).toContain('featured categories unavailable');
    expect((await getStatsCounts(database.db)).games).toBe(25);

    await app.app.close();
    await database.cleanup();
  });
});

