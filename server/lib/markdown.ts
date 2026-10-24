import type { CategoryFlags, CategoryKey, GameMention } from '../../shared/types';
import type { NewsEntryInput } from '../types';
import {
  aggregateFlags,
  classifyText,
  createEmptyFlags,
  extractBoldGameNames,
  type GameMatcher,
} from './classify';
import {
  cleanMarkdown,
  extractUrls,
  safeHttpUrl,
  truncate,
  uniqueBy,
} from './text';

export interface ParseReleaseOptions {
  matcher: GameMatcher;
  releaseUrl: string;
}

export interface ParsedRelease {
  entries: NewsEntryInput[];
  flags: CategoryFlags;
  summary: string;
}

interface BulletBlock {
  indent: number;
  lines: string[];
  section: string | null;
  hasChildren: boolean;
  ancestorSection: string | null;
}

const SKIP_TEXT =
  /^(?:full changelog|changes since|thanks|contributors?|checksums?|sha256|installation|notes?|hotfix release|this is likely|a small update|a ton of work)\b/i;

const META_ONLY =
  /^(?:https?:\/\/\S+|\S+\.(?:tar\.xz|zip|tar\.gz|7z|exe|dll))$/i;

function normalizeHeading(value: string): string {
  return cleanMarkdown(value.replace(/\s+#+\s*$/, '')).replace(/:$/, '').trim();
}

function hasUsefulText(value: string): boolean {
  const text = cleanMarkdown(value);
  if (!text || text.length < 3) return false;
  if (META_ONLY.test(text)) return false;
  if (SKIP_TEXT.test(text)) return false;
  return true;
}

function isMetaEntry(value: string): boolean {
  const text = cleanMarkdown(value);
  return !hasUsefulText(text);
}

function pickExternalUrl(raw: string, fallback: string): string {
  const urls = extractUrls(raw)
    .map((url) => safeHttpUrl(url))
    .filter((url): url is string => Boolean(url));
  const preferred = urls.find((url) => /\/(?:issues|pull|pull-request|merge_requests)\//i.test(url));
  return preferred ?? urls[0] ?? fallback;
}

function isGameNameCandidate(text: string): boolean {
  const cleaned = cleanMarkdown(text);
  if (!cleaned || cleaned.length > 90) return false;
  if (cleaned.split(/\s+/).length > 9) return false;
  if (/[.!?;]$/.test(cleaned)) return false;
  if (/\b(?:fixed|improved|added|support|should no longer|now playable|regression)\b/i.test(cleaned)) {
    return false;
  }
  return true;
}

function mentionsFor(
  text: string,
  raw: string,
  matcher: GameMatcher,
  options: { newlyPlayable: boolean },
): GameMention[] {
  const mentions = matcher.match(text);
  mentions.push(...extractBoldGameNames(raw, matcher));
  if (options.newlyPlayable && isGameNameCandidate(text)) {
    mentions.push({ name: cleanMarkdown(text), appid: null });
  }
  return uniqueBy(mentions, (item) =>
    item.appid != null ? `appid:${item.appid}` : `name:${item.name.toLowerCase()}`,
  ).slice(0, 6);
}

function defaultFlagsForSection(section: string): CategoryFlags {
  const flags = createEmptyFlags();
  const normalized = section.toLowerCase();
  if (/\bnow playable\b/.test(normalized)) {
    flags.newlyPlayable = true;
    flags.feature = true;
    flags.compat = true;
  } else if (/bug fixes? and improvements?/.test(normalized)) {
    return flags;
  } else if (/\b(?:fix|fixes|fixed|bug fixes?)\b/.test(normalized)) {
    flags.bugfix = true;
  } else if (/\bfeatures?\b/.test(normalized)) {
    flags.feature = true;
  } else if (/protonfixes/.test(normalized)) {
    flags.bugfix = true;
  }
  return flags;
}

function applySectionDefaults(flags: CategoryFlags, defaults: CategoryFlags): void {
  flags.feature ||= defaults.feature;
  flags.bugfix ||= defaults.bugfix;
  flags.compat ||= defaults.compat;
  flags.newlyPlayable ||= defaults.newlyPlayable;
}

function mergeFlags(...sources: CategoryFlags[]): CategoryFlags {
  const merged = createEmptyFlags();
  for (const flags of sources) {
    merged.feature ||= flags.feature;
    merged.bugfix ||= flags.bugfix;
    merged.compat ||= flags.compat;
    merged.performance ||= flags.performance;
    merged.anticheat ||= flags.anticheat;
    merged.newlyPlayable ||= flags.newlyPlayable;
    merged.discussion ||= flags.discussion;
  }
  return merged;
}

function makeEntry(
  rawText: string,
  section: string | null,
  matcher: GameMatcher,
  releaseUrl: string,
  inheritedDefaults: CategoryFlags,
): NewsEntryInput | null {
  const text = cleanMarkdown(rawText);
  if (!hasUsefulText(text)) return null;

  const sectionName = section ?? '';
  const defaults = mergeFlags(defaultFlagsForSection(sectionName), inheritedDefaults);
  const newlyPlayable =
    defaults.newlyPlayable || /\b(?:now playable|newly playable|playable again)\b/i.test(`${sectionName} ${text}`);
  const games = mentionsFor(text, rawText, matcher, { newlyPlayable });
  const classification = classifyText(text, { games });
  const explicitBugfix = classification.flags.bugfix;
  const explicitFeature = classification.flags.feature;

  const flags: CategoryFlags = { ...classification.flags };
  applySectionDefaults(flags, defaults);
  if (newlyPlayable) {
    flags.newlyPlayable = true;
    flags.feature = true;
    flags.compat = true;
  }

  const startsWithFeature =
    /^(?:added|adds|implemented|implements|supports?|supported|new|exposed?|allows?|introduc(?:e|es|ed|ing)|enabled?|improved|updated)\b/i.test(
      text,
    );

  let category: CategoryKey = classification.category;
  if (newlyPlayable) category = 'newly-playable';
  else if (flags.anticheat) category = 'anticheat';
  else if (defaults.bugfix) category = 'bugfix';
  else if (explicitBugfix && !startsWithFeature) category = 'bugfix';
  else if (explicitFeature || startsWithFeature) category = 'feature';
  else if (flags.bugfix) category = 'bugfix';
  else if (flags.feature) category = 'feature';
  else if (flags.performance) category = 'performance';
  else if (flags.compat) category = 'compat';

  return {
    section: sectionName || null,
    text: truncate(text, 900),
    category,
    flags,
    games,
    externalUrl: pickExternalUrl(rawText, releaseUrl),
  };
}

interface Collected {
  entries: NewsEntryInput[];
  intro: string[];
}

function collectMarkdownBody(body: string, matcher: GameMatcher, releaseUrl: string): Collected {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BulletBlock[] = [];
  const intro: string[] = [];
  let section: string | null = null;
  let current: BulletBlock | null = null;
  let fence = false;

  function finishCurrent(): void {
    if (current && current.lines.some((line) => line.trim())) {
      blocks.push(current);
    }
    current = null;
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      finishCurrent();
      continue;
    }
    if (fence) continue;

    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      finishCurrent();
      const level = heading[1]?.length ?? 1;
      section = level <= 3 ? normalizeHeading(heading[2] ?? '') || null : section;
      continue;
    }

    const bullet = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      finishCurrent();
      const indent = (bullet[1] ?? '').replace(/\t/g, '  ').length;
      const text = bullet[2] ?? '';
      current = { indent, lines: [text], section, hasChildren: false, ancestorSection: null };
      continue;
    }

    if (current) {
      if (line.trim()) {
        current.lines.push(line.trim());
      } else {
        finishCurrent();
      }
      continue;
    }

    if (line.trim() && !line.startsWith('>') && !/^\s*---+\s*$/.test(line)) {
      intro.push(line.trim());
    }
  }
  finishCurrent();

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (!block) continue;
    const next = blocks[index + 1];
    block.hasChildren = Boolean(next && next.indent > block.indent);
  }

  const entries: NewsEntryInput[] = [];
  const stack: { indent: number; text: string; defaults: CategoryFlags }[] = [];

  for (const block of blocks) {
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= block.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const raw = block.lines.join(' ');
    const text = cleanMarkdown(raw);
    const parentSection = parent?.text ?? null;
    const effectiveSection = parentSection ?? block.section;
    const inherited = parent?.defaults ?? createEmptyFlags();

    if (block.hasChildren || /:$/.test(text)) {
      const defaults = mergeFlags(
        defaultFlagsForSection(block.section ?? ''),
        defaultFlagsForSection(text),
        inherited,
      );
      if (/\bnow playable\b/i.test(text)) {
        defaults.newlyPlayable = true;
        defaults.feature = true;
        defaults.compat = true;
      }
      if (/\b(?:game|regressions?|playable|launcher|controller|anti[- ]?cheat)\b/i.test(text)) {
        defaults.compat = true;
      }
      if (text && hasUsefulText(text)) {
        stack.push({ indent: block.indent, text: text.replace(/:$/, ''), defaults });
      }
      continue;
    }

    if (isMetaEntry(text)) continue;
    const entry = makeEntry(raw, effectiveSection, matcher, releaseUrl, inherited);
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    const paragraphs = intro.filter((line) => !isMetaEntry(line));
    if (paragraphs.length > 0) {
      const entry = makeEntry(paragraphs.join(' '), section, matcher, releaseUrl, createEmptyFlags());
      if (entry) entries.push(entry);
    }
  }

  return { entries, intro };
}

function summarize(entries: NewsEntryInput[]): string {
  const newlyPlayable = entries.filter((entry) => entry.flags.newlyPlayable);
  const gameFixes = entries.filter((entry) => entry.flags.bugfix && entry.flags.compat);
  const features = entries.filter((entry) => entry.flags.feature && !entry.flags.newlyPlayable);
  const fixes = entries.filter((entry) => entry.flags.bugfix);

  const parts: string[] = [];
  if (newlyPlayable.length > 0) {
    const names = newlyPlayable
      .map((entry) => entry.text.replace(/^now playable\s*:?\s*/i, ''))
      .filter(Boolean)
      .slice(0, 3);
    parts.push(`Newly playable: ${names.join(', ')}`);
  }
  if (features.length > 0) {
    parts.push(features[0]?.text ?? '');
  } else if (gameFixes.length > 0) {
    parts.push(gameFixes[0]?.text ?? '');
  }
  if (fixes.length > 0) parts.push(`${fixes.length} fixes`);
  if (parts.length === 0) parts.push(entries[0]?.text ?? '');
  return truncate(parts.filter(Boolean).join(' · '), 340);
}

export function parseReleaseMarkdown(body: string, options: ParseReleaseOptions): ParsedRelease {
  const { entries } = collectMarkdownBody(body, options.matcher, options.releaseUrl);
  const limited = entries.slice(0, 150);
  const flags = aggregateFlags(limited);
  return { entries: limited, flags, summary: summarize(limited) };
}

function extractSection(description: string, headingPattern: RegExp): { body: string; heading: string | null } {
  const lines = description.replace(/\r\n?/g, '\n').split('\n');
  let start = -1;
  let heading: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (headingPattern.test(line)) {
      start = index + 1;
      heading = line.trim();
      break;
    }
  }
  if (start < 0) return { body: '', heading: null };
  const end = lines.findIndex((line, index) => {
    if (index <= start) return false;
    return /^#{2,4}\s+/.test(line) || /^-{10,}\s*$/.test(line);
  });
  const body = lines.slice(start, end === -1 ? lines.length : end).join('\n');
  return { body, heading };
}

export function parseWineRelease(description: string, options: ParseReleaseOptions): ParsedRelease {
  const matcher = options.matcher;
  const beforeChanges = description.split(/^###?\s+Changes since\b/im)[0] ?? description;
  const entries: NewsEntryInput[] = [];

  const whatsNew = extractSection(beforeChanges, /what'?s new in this release/i);
  for (const line of whatsNew.body.split('\n')) {
    const match = /^\s*[-*]\s+(.+)$/.exec(line);
    if (!match) continue;
    const raw = match[1] ?? '';
    const text = cleanMarkdown(raw);
    if (!text || /^various bug fixes\.?$/i.test(text)) continue;
    const games = mentionsFor(text, raw, matcher, { newlyPlayable: false });
    const classification = classifyText(text, { games });
    const flags = { ...classification.flags, feature: true };
    let category: CategoryKey = 'feature';
    if (flags.bugfix) category = 'bugfix';
    else if (flags.performance) category = 'performance';
    else if (flags.compat) category = 'compat';
    entries.push({
      section: 'What’s new',
      text: truncate(text, 900),
      category,
      flags,
      games,
      externalUrl: options.releaseUrl,
    });
  }

  const bugs = extractSection(beforeChanges, /bugs fixed in/i);
  const bugSection = bugs.heading?.replace(/^#+\s*/, '').replace(/:$/, '') ?? 'Bugs fixed';
  for (const line of bugs.body.split('\n')) {
    const match = /^\s*-\s*(?:#(\d+))?\s*(.+)$/.exec(line);
    if (!match) continue;
    const bugId = match[1] ?? null;
    const raw = match[2] ?? '';
    const text = cleanMarkdown(raw);
    if (!text || text.length < 3) continue;
    const games = mentionsFor(text, raw, matcher, { newlyPlayable: false });
    const classification = classifyText(text, { games });
    const flags = { ...classification.flags, bugfix: true, compat: classification.flags.compat || games.length > 0 };
    entries.push({
      section: bugSection,
      text: truncate(text, 900),
      category: 'bugfix',
      flags,
      games,
      externalUrl: bugId ? `https://bugs.winehq.org/show_bug.cgi?id=${bugId}` : options.releaseUrl,
    });
  }

  const limited = entries.slice(0, 180);
  const flags = aggregateFlags(limited);
  return {
    entries: limited,
    flags,
    summary: summarize(limited),
  };
}

