import Parser from 'rss-parser';
import type { NewsItemInput, SourceConfig } from '../types';
import type { CategoryFlags, NewsKind } from '../../shared/types';
import type { SyncContext } from '../services/context';
import { classifyText } from '../lib/classify';
import { makeId } from '../lib/hash';
import { cleanText, safeHttpUrl, stripHtml, truncate, uniqueBy } from '../lib/text';
import { parseDateToEpoch } from '../lib/time';

const parser = new Parser({
  customFields: {
    item: [
      ['dc:creator', 'dcCreator'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

function itemCategories(item: Parser.Item): string[] {
  return (item.categories ?? [])
    .map((category) => (typeof category === 'string' ? category : String(category)))
    .map((category) => stripHtml(category))
    .filter(Boolean);
}

function isRelevant(source: SourceConfig, text: string, categories: string[]): boolean {
  if (source.exclude && source.exclude.test(text)) return false;
  if (!source.include && !source.includeCategories) return true;
  if (source.include && source.include.test(text)) return true;
  if (source.includeCategories) {
    const lower = categories.map((category) => category.toLowerCase());
    return source.includeCategories.some((category) =>
      lower.includes(category.toLowerCase()),
    );
  }
  return false;
}

function cleanFeedSummary(input: string): string {
  return cleanText(input)
    .replace(/\bRead the full article on\s+[^.]{1,90}\.?/gi, ' ')
    .replace(/\bThe post .{0,180}? appeared first on .{0,90}?\.?/gi, ' ')
    .replace(/\bsubmitted by\s+\/u\/[^\s\]]+/gi, ' ')
    .replace(/\[link\]\s*\[comments\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyCategoryHints(flags: CategoryFlags, categories: string[]): void {
  const text = categories.join(' ').toLowerCase();
  if (/anti[- ]?cheat|battleye|easy anti[- ]?cheat/.test(text)) {
    flags.anticheat = true;
    flags.compat = true;
  }
  if (/proton|wine|steam deck|steam play|steamos|dxvk|vkd3d|steam machine|steam frame/.test(text)) {
    flags.compat = true;
  }
}

export async function fetchRssSource(
  ctx: SyncContext,
  source: SourceConfig,
): Promise<NewsItemInput[]> {
  if (!source.url) return [];
  const response = await ctx.http.getText(source.url, {
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    userAgent: source.userAgent,
  });
  const feed = await parser.parseString(response.body);
  const kind: NewsKind = source.kind === 'reddit' ? 'discussion' : 'article';
  const now = ctx.now();
  const items: NewsItemInput[] = [];

  for (const item of feed.items ?? []) {
    const title = cleanText(item.title ?? '');
    const url = safeHttpUrl(item.link || item.guid, source.homepage);
    if (!title || !url) continue;

    const categories = itemCategories(item);
    const rawItem = item as unknown as Record<string, unknown>;
    const summarySource =
      item.contentSnippet ??
      item.summary ??
      (typeof item.content === 'string' ? stripHtml(item.content) : '') ??
      (typeof rawItem.description === 'string' ? rawItem.description : '') ??
      '';
    const summary = truncate(cleanFeedSummary(String(summarySource)), 500);
    if (!isRelevant(source, `${title} ${summary}`, categories)) continue;

    const author =
      cleanText(
        String(item.creator ?? item.dcCreator ?? rawItem.author ?? '') || '',
      ) || null;
    const publishedAt = parseDateToEpoch(item.isoDate ?? item.pubDate ?? null);
    const games = uniqueBy(
      ctx.matcher.match(`${title} ${summary}`),
      (game) => (game.appid != null ? `appid:${game.appid}` : `name:${game.name.toLowerCase()}`),
    ).slice(0, 6);
    const classification = classifyText(`${title} ${summary}`, { kind, games });
    applyCategoryHints(classification.flags, categories);

    items.push({
      id: makeId(source.id, url),
      sourceId: source.id,
      sourceName: source.name,
      kind,
      title: truncate(title, 300),
      url,
      summary: summary || null,
      author,
      version: null,
      publishedAt,
      discoveredAt: now,
      flags: classification.flags,
      games,
      entries: [],
    });

    if (items.length >= (source.maxItems ?? 30)) break;
  }

  return uniqueBy(items, (item) => item.url);
}

