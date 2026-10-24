import type { CategoryFlags, GameMention } from '../../shared/types';
import type { NewsEntryInput, NewsItemInput, SourceConfig } from '../types';
import type { SyncContext } from '../services/context';
import { aggregateFlags, classifyText, createEmptyFlags } from '../lib/classify';
import { makeId } from '../lib/hash';
import { parseWineRelease } from '../lib/markdown';
import { cleanMarkdown, safeHttpUrl, truncate, uniqueBy } from '../lib/text';
import { parseDateToEpoch } from '../lib/time';
import { getMeta, setMeta } from '../db/repository';

interface GitlabRelease {
  name: string;
  tag_name: string;
  description: string;
  created_at: string;
  released_at: string | null;
  _links?: { self?: string };
}

function aggregateGames(entries: { games: GameMention[] }[]): GameMention[] {
  return uniqueBy(
    entries.flatMap((entry) => entry.games),
    (game) => (game.appid != null ? `appid:${game.appid}` : `name:${game.name.toLowerCase()}`),
  ).slice(0, 10);
}

export async function fetchWineSource(
  ctx: SyncContext,
  source: SourceConfig,
): Promise<NewsItemInput[]> {
  if (!source.url) return [];
  const etagKey = `etag:gitlab:${source.id}`;
  const etag = await getMeta(ctx.db, etagKey);
  const response = await ctx.http.getJson<GitlabRelease[]>(source.url, { etag });
  if (response.notModified) return [];
  if (response.etag) await setMeta(ctx.db, etagKey, response.etag);

  const releases = (response.data ?? [])
    .filter((release) => /^wine-\d+\.\d+$/i.test(release.tag_name))
    .sort(
      (a, b) =>
        (parseDateToEpoch(b.released_at ?? b.created_at) ?? 0) -
        (parseDateToEpoch(a.released_at ?? a.created_at) ?? 0),
    )
    .slice(0, source.maxItems ?? 6);

  const now = ctx.now();
  const items: NewsItemInput[] = [];

  for (const release of releases) {
    const url =
      safeHttpUrl(release._links?.self) ??
      safeHttpUrl(
        `https://gitlab.winehq.org/wine/wine/-/releases/${encodeURIComponent(release.tag_name)}`,
      );
    if (!url) continue;
    const title = release.name?.trim() || `Wine ${release.tag_name.replace(/^wine-/i, '')}`;
    let entries: NewsEntryInput[] = [];
    let flags: CategoryFlags = createEmptyFlags();
    let summary = '';
    try {
      const parsed = parseWineRelease(release.description ?? '', {
        matcher: ctx.matcher,
        releaseUrl: url,
      });
      entries = parsed.entries;
      flags = parsed.flags;
      summary = parsed.summary;
    } catch {
      entries = [];
      flags = createEmptyFlags();
      summary = truncate(cleanMarkdown(release.description ?? ''), 340);
    }
    if (entries.length === 0) {
      const classification = classifyText(`${title} ${summary}`);
      flags = classification.flags;
    }
    if (!summary) summary = `${title} release`;

    items.push({
      id: makeId(source.id, release.tag_name),
      sourceId: source.id,
      sourceName: source.name,
      kind: 'release',
      title: truncate(title, 300),
      url,
      summary: summary || null,
      author: null,
      version: release.tag_name,
      publishedAt: parseDateToEpoch(release.released_at ?? release.created_at),
      discoveredAt: now,
      flags: aggregateFlags(entries.length > 0 ? entries : [{ flags }]),
      games: aggregateGames(entries),
      entries,
    });
  }

  return items;
}
