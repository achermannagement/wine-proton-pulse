import { afterEach, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { createTestDb, createFixtureContext, staticHttpClient, type TestDatabase } from '../test/helpers';
import { fetchWineSource } from './wine';
import { fetchGithubSource } from './github';
import { fetchRssSource } from './rss';
import type { SourceConfig } from '../types';

let testDb: TestDatabase | null = null;

afterEach(async () => {
  if (testDb) await testDb.cleanup();
  testDb = null;
});

async function db(): Promise<Client> {
  testDb = await createTestDb();
  return testDb.db;
}

function source(ctx: ReturnType<typeof createFixtureContext>, id: string): SourceConfig {
  const found = ctx.config.sources.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing source ${id}`);
  return found;
}

describe('WineHQ source', () => {
  it('fetches and parses Wine releases', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const items = await fetchWineSource(ctx, source(ctx, 'winehq'));

    expect(items).toHaveLength(3);
    expect(items[0]?.version).toBe('wine-11.20');
    expect(items[0]?.title).toBe('Wine 11.20');
    expect(items[0]?.kind).toBe('release');
    expect(items[0]?.url).toContain('gitlab.winehq.org');
    expect(items[0]?.entries.length).toBeGreaterThan(20);
    expect(items[0]?.flags.feature).toBe(true);
    expect(items[0]?.flags.bugfix).toBe(true);
    expect(items[0]?.games.length).toBeGreaterThanOrEqual(0);
  });

  it('honors the per-source item cap', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const winehq = source(ctx, 'winehq');
    const items = await fetchWineSource(ctx, { ...winehq, maxItems: 1 });
    expect(items).toHaveLength(1);
  });
});

describe('GitHub release source', () => {
  it('parses Valve Proton stable releases', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const items = await fetchGithubSource(ctx, source(ctx, 'proton'));

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.version)).toEqual([
      'proton-11.0-2e',
      'proton-11.0-2',
      'proton-11.0-1',
    ]);
    expect(items[1]?.entries.length).toBeGreaterThan(40);
    expect(items[1]?.flags.newlyPlayable).toBe(true);
    expect(items[1]?.title).toContain('Proton 11.0-2');
  });

  it('parses GE-Proton and DXVK releases', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const ge = await fetchGithubSource(ctx, source(ctx, 'ge-proton'));
    expect(ge).toHaveLength(2);
    expect(ge[0]?.title).toContain('GE-Proton');

    const dxvk = await fetchGithubSource(ctx, source(ctx, 'dxvk'));
    expect(dxvk).toHaveLength(2);
    expect(dxvk[0]?.title).toContain('DXVK');
    expect(dxvk[0]?.flags.bugfix).toBe(true);
  });

  it('keeps stable Proton releases and excludes betas and bleeding-edge builds', async () => {
    const database = await db();
    const releases = [
      {
        tag_name: 'proton-11.0-2',
        name: 'Proton 11.0-2',
        body: '- Fixed a crash in a game.',
        html_url: 'https://example.com/1',
        published_at: '2026-10-10T00:00:00Z',
        created_at: '2026-10-10T00:00:00Z',
        prerelease: false,
        draft: false,
      },
      {
        tag_name: 'proton-11.0-1-beta1',
        name: 'Proton 11.0 beta',
        body: '- Beta change.',
        html_url: 'https://example.com/2',
        published_at: '2026-10-09T00:00:00Z',
        created_at: '2026-10-09T00:00:00Z',
        prerelease: false,
        draft: false,
      },
      {
        tag_name: 'experimental-bleeding-edge-11.0-1',
        name: 'Bleeding edge',
        body: '- Nightly change.',
        html_url: 'https://example.com/3',
        published_at: '2026-10-11T00:00:00Z',
        created_at: '2026-10-11T00:00:00Z',
        prerelease: false,
        draft: false,
      },
      {
        tag_name: 'proton-10.0-4b',
        name: 'Proton 10.0-4b',
        body: '- Fixed a crash.',
        html_url: 'https://example.com/4',
        published_at: '2026-10-08T00:00:00Z',
        created_at: '2026-10-08T00:00:00Z',
        prerelease: false,
        draft: false,
      },
    ];
    const http = staticHttpClient(releases);
    const ctx = createFixtureContext(database, { http });
    const items = await fetchGithubSource(ctx, source(ctx, 'proton'));
    expect(items.map((item) => item.version)).toEqual(['proton-11.0-2', 'proton-10.0-4b']);
  });

  it('returns no items for a 304 Not Modified response', async () => {
    const database = await db();
    const http = staticHttpClient([], { notModified: true });
    const ctx = createFixtureContext(database, { http });
    const items = await fetchGithubSource(ctx, source(ctx, 'proton'));
    expect(items).toEqual([]);
  });
});

describe('RSS source', () => {
  it('filters GamingOnLinux to relevant posts and strips HTML', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const items = await fetchRssSource(ctx, source(ctx, 'gamingonlinux'));

    expect(items.length).toBeGreaterThan(5);
    expect(items.length).toBeLessThanOrEqual(20);
    expect(items.every((item) => item.kind === 'article')).toBe(true);
    expect(items.every((item) => item.summary == null || !item.summary.includes('<'))).toBe(true);
    expect(items.some((item) => /humble bundle|fanatical|review/i.test(item.title))).toBe(false);
    expect(items.some((item) => /proton|wine|steam deck|steamos|anti-cheat/i.test(item.title))).toBe(
      true,
    );
  });

  it('filters Phoronix to Wine/Proton/Valve headlines', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const items = await fetchRssSource(ctx, source(ctx, 'phoronix'));

    expect(items.length).toBeGreaterThan(0);
    expect(
      items.every((item) =>
        /\b(?:wine|proton|valve|steam|dxvk|vkd3d|steamos|steam deck)\b/i.test(
          `${item.title} ${item.summary ?? ''}`,
        ),
      ),
    ).toBe(true);
  });

  it('categorizes Reddit posts as community discussions', async () => {
    const database = await db();
    const ctx = createFixtureContext(database);
    const items = await fetchRssSource(ctx, source(ctx, 'reddit'));

    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(12);
    expect(items.every((item) => item.kind === 'discussion')).toBe(true);
    expect(items.every((item) => item.flags.discussion)).toBe(true);
    expect(items.every((item) => !item.flags.bugfix && !item.flags.feature)).toBe(true);
  });

  it('respects include and exclude filters and deduplicates URLs', async () => {
    const database = await db();
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Fanatical bundle sale</title><link>https://example.com/bundle</link><description><![CDATA[<p>Great deal &amp; more</p>]]></description></item>
      <item><title>Proton 11 adds HDR support</title><link>https://example.com/proton</link><description>Proton news</description></item>
      <item><title>Proton 11 adds HDR support</title><link>https://example.com/proton</link><description>Duplicate</description></item>
    </channel></rss>`;
    const ctx = createFixtureContext(database, { http: staticHttpClient(xml) });
    const gol = source(ctx, 'gamingonlinux');
    const items = await fetchRssSource(ctx, { ...gol, maxItems: 10 });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Proton 11 adds HDR support');
  });

  it('strips feed boilerplate from summaries', async () => {
    const database = await db();
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Proton 11 news</title><link>https://example.com/proton-news</link><description><![CDATA[<p>Proton story body.</p><p>Read the full article on <a href="https://example.com">GamingOnLinux</a></p>]]></description></item>
    </channel></rss>`;
    const ctx = createFixtureContext(database, { http: staticHttpClient(xml) });
    const items = await fetchRssSource(ctx, source(ctx, 'gamingonlinux'));
    expect(items[0]?.summary).toBe('Proton story body.');
  });

  it('skips malformed items without links or titles', async () => {
    const database = await db();
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Proton news without link</title><description>No URL</description></item>
      <item><link>https://example.com/no-title</link><description>No title</description></item>
      <item><title>Valid Proton story</title><link>https://example.com/valid</link><description>Works</description></item>
    </channel></rss>`;
    const ctx = createFixtureContext(database, { http: staticHttpClient(xml) });
    const items = await fetchRssSource(ctx, source(ctx, 'gamingonlinux'));
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe('https://example.com/valid');
  });
});
