import { afterEach, describe, expect, it } from 'vitest';
import { createFixtureContext, createTestDb, readFixtureJson, type TestDatabase } from '../test/helpers';
import {
  parseSteamAppDetails,
  parseSteamFeatured,
  parseSteamSearch,
} from './steam';
import { parseProtonDbSummary, fetchProtonDbSummary } from './protondb';
import { parseAwaGames } from './awa';

let testDb: TestDatabase | null = null;

afterEach(async () => {
  if (testDb) await testDb.cleanup();
  testDb = null;
});

describe('Steam parsers', () => {
  it('parses featured top sellers and new releases', () => {
    const featured = parseSteamFeatured(
      readFixtureJson<Parameters<typeof parseSteamFeatured>[0]>('steam-featured.json'),
    );
    expect(featured).toHaveLength(10);
    expect(featured[0]).toMatchObject({
      appid: 1245620,
      name: 'ELDEN RING',
      storeUrl: 'https://store.steampowered.com/app/1245620/',
    });
    expect(featured.find((game) => game.appid === 570)?.isNative).toBe(true);
  });

  it('parses Steam store search results in Steam order', () => {
    const results = parseSteamSearch(
      readFixtureJson<Parameters<typeof parseSteamSearch>[0]>('steam-search.json'),
    );
    expect(results).toHaveLength(6);
    expect(results[0]).toMatchObject({ appid: 1245620, name: 'ELDEN RING' });
    expect(results[0]?.platforms.windows).toBe(true);
  });

  it('parses Steam app details', () => {
    const details = parseSteamAppDetails(
      readFixtureJson<Parameters<typeof parseSteamAppDetails>[0]>('steam-appdetails.json'),
      1245620,
    );
    expect(details).toMatchObject({
      appid: 1245620,
      name: 'ELDEN RING',
      isNative: false,
    });
    expect(details?.headerImage).toContain('steamstatic.com');
    expect(parseSteamAppDetails({}, 999)).toBeNull();
  });
});

describe('ProtonDB parser', () => {
  it('maps a summary response', () => {
    const summary = parseProtonDbSummary(
      readFixtureJson<Record<string, unknown>>('protondb-summaries.json')['1245620'],
    );
    expect(summary).toMatchObject({
      tier: 'gold',
      trendingTier: 'platinum',
      bestTier: 'platinum',
      score: 0.79,
      confidence: 'strong',
      total: 2106,
    });
  });

  it('falls back to pending for missing or invalid data', () => {
    expect(parseProtonDbSummary(null).tier).toBe('pending');
    expect(parseProtonDbSummary({ tier: 'not-a-tier' }).tier).toBe('pending');
    expect(parseProtonDbSummary({ tier: 'GOLD' }).tier).toBe('gold');
  });

  it('returns null for an unknown appid (404)', async () => {
    const test = await createTestDb();
    testDb = test;
    const ctx = createFixtureContext(test.db);
    await expect(fetchProtonDbSummary(ctx, 999999)).resolves.toBeNull();
  });
});

describe('Are We Anti-Cheat Yet parser', () => {
  const games = parseAwaGames(readFixtureJson<unknown>('awa-games.json'));

  it('parses anti-cheat status, Steam ids and notes', () => {
    expect(games.length).toBeGreaterThan(15);
    const halo = games.find((game) => game.name === 'Halo: The Master Chief Collection');
    expect(halo).toMatchObject({
      appid: 976730,
      status: 'Supported',
      native: false,
    });
    expect(halo?.anticheats).toContain('Easy Anti-Cheat');
    expect(halo?.notes.length).toBeGreaterThan(0);
  });

  it('handles games without a Steam id', () => {
    const fortnite = games.find((game) => game.name === 'Fortnite');
    expect(fortnite?.appid).toBeNull();
    expect(fortnite?.status).toBe('Denied');
  });

  it('returns an empty list for malformed payloads', () => {
    expect(parseAwaGames({})).toEqual([]);
    expect(parseAwaGames([{ name: '' }])).toEqual([]);
  });
});
