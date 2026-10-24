import type { CategoryFlags, GameMention, NewsKind } from '../../shared/types';
import type { NewsEntryInput, NewsItemInput, SourceConfig } from '../types';
import type { SyncContext } from '../services/context';
import { aggregateFlags, classifyText, createEmptyFlags } from '../lib/classify';
import { makeId } from '../lib/hash';
import { parseReleaseMarkdown } from '../lib/markdown';
import { cleanMarkdown, safeHttpUrl, truncate, uniqueBy } from '../lib/text';
import { parseDateToEpoch } from '../lib/time';
import { getMeta, setMeta } from '../db/repository';

interface GithubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
}

function isStableProtonTag(tag: string): boolean {
  return /^proton-\d+\.\d+-\d+[a-z]?$/i.test(tag);
}

function shouldInclude(source: SourceConfig, release: GithubRelease): boolean {
  if (release.draft || release.prerelease) return false;
  switch (source.id) {
    case 'proton':
      return isStableProtonTag(release.tag_name);
    case 'ge-proton':
      return /^GE-Proton/i.test(release.tag_name);
    case 'dxvk':
      return !/^v?\d+\.\d+-rc/i.test(release.tag_name);
    case 'vkd3d-proton':
      return !/rc/i.test(release.tag_name);
    default:
      return true;
  }
}

function titleFor(source: SourceConfig, release: GithubRelease): string {
  const name = (release.name ?? '').trim();
  if (source.id === 'dxvk') {
    return `DXVK ${name.replace(/^Version\s+/i, '') || release.tag_name}`;
  }
  if (source.id === 'vkd3d-proton') {
    return `VKD3D-Proton ${name.replace(/^Version\s+/i, '') || release.tag_name}`;
  }
  if (source.id === 'proton') {
    return name || `Proton ${release.tag_name.replace(/^proton-/i, '')}`;
  }
  return name || release.tag_name;
}

function aggregateGames(entries: { games: GameMention[] }[]): GameMention[] {
  return uniqueBy(
    entries.flatMap((entry) => entry.games),
    (game) => (game.appid != null ? `appid:${game.appid}` : `name:${game.name.toLowerCase()}`),
  ).slice(0, 10);
}

export async function fetchGithubSource(
  ctx: SyncContext,
  source: SourceConfig,
): Promise<NewsItemInput[]> {
  if (!source.repo) return [];
  const apiUrl = `https://api.github.com/repos/${source.repo}/releases?per_page=30`;
  const etagKey = `etag:github:${source.id}`;
  const etag = await getMeta(ctx.db, etagKey);
  const response = await ctx.http.getJson<GithubRelease[]>(apiUrl, {
    etag,
    accept: 'application/vnd.github+json',
    headers: { 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (response.notModified) return [];
  if (response.etag) await setMeta(ctx.db, etagKey, response.etag);

  const releases = (response.data ?? [])
    .filter((release) => shouldInclude(source, release))
    .sort(
      (a, b) =>
        (parseDateToEpoch(b.published_at ?? b.created_at) ?? 0) -
        (parseDateToEpoch(a.published_at ?? a.created_at) ?? 0),
    )
    .slice(0, source.maxItems ?? 6);

  const now = ctx.now();
  const kind: NewsKind = 'release';
  const items: NewsItemInput[] = [];

  for (const release of releases) {
    const url = safeHttpUrl(release.html_url);
    if (!url) continue;
    const title = titleFor(source, release);
    const body = release.body ?? '';
    let entries: NewsEntryInput[] = [];
    let flags: CategoryFlags = createEmptyFlags();
    let summary = '';
    try {
      const parsed = parseReleaseMarkdown(body, {
        matcher: ctx.matcher,
        releaseUrl: url,
      });
      entries = parsed.entries;
      flags = parsed.flags;
      summary = parsed.summary;
    } catch {
      entries = [];
      flags = createEmptyFlags();
      summary = truncate(cleanMarkdown(body), 340);
    }

    if (entries.length === 0) {
      const fallback = truncate(cleanMarkdown(body), 340);
      summary = fallback || `${title} release`;
      const classification = classifyText(`${title} ${fallback}`);
      flags = classification.flags;
    }
    if (!summary) {
      summary = `${title} release`;
    }

    items.push({
      id: makeId(source.id, release.tag_name),
      sourceId: source.id,
      sourceName: source.name,
      kind,
      title: truncate(title, 300),
      url,
      summary: summary || null,
      author: null,
      version: release.tag_name,
      publishedAt: parseDateToEpoch(release.published_at ?? release.created_at),
      discoveredAt: now,
      flags: aggregateFlags(entries.length > 0 ? entries : [{ flags }]),
      games: aggregateGames(entries),
      entries,
    });
  }

  return items;
}
