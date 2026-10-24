import type { CategoryFlags, CategoryKey, GameMention, NewsKind } from '../../shared/types';
import { GAME_ALIASES, SINGLE_WORD_ALLOWLIST } from './gameAliases';
import { cleanMarkdown, normalizeName, uniqueBy } from './text';

export interface GameMatcher {
  match(text: string): GameMention[];
}

interface MatcherCandidate {
  name: string;
  key: string;
  appid: number | null;
  explicit: boolean;
}

const GENERIC_SINGLE_WORDS = new Set([
  'control',
  'prey',
  'doom',
  'rage',
  'inside',
  'limbo',
  'bastion',
  'transistor',
  'journey',
  'firewatch',
  'witness',
  'halo',
  'destiny',
  'origin',
  'steam',
  'windows',
  'linux',
  'proton',
  'wine',
]);

function isUsableName(candidate: MatcherCandidate): boolean {
  const words = candidate.key.split(' ').filter(Boolean);
  if (words.length === 0 || candidate.key.length < 3) return false;
  if (GENERIC_SINGLE_WORDS.has(candidate.key)) return false;
  if (words.length === 1) {
    if (candidate.explicit) return true;
    if (SINGLE_WORD_ALLOWLIST.has(candidate.key)) return true;
    return candidate.key.length >= 9;
  }
  return candidate.key.length >= 5;
}

export function createGameMatcher(
  entries: { name: string; appid?: number | null }[],
): GameMatcher {
  const candidates = new Map<string, MatcherCandidate>();

  function add(name: string, appid: number | null, explicit: boolean): void {
    const key = normalizeName(name);
    if (!key) return;
    const candidate: MatcherCandidate = { name: name.trim(), key, appid, explicit };
    if (!isUsableName(candidate)) return;
    const existing = candidates.get(key);
    if (!existing || (existing.appid == null && appid != null)) {
      candidates.set(key, candidate);
    }
  }

  for (const entry of entries) {
    add(entry.name, entry.appid ?? null, false);
  }
  for (const alias of GAME_ALIASES) {
    add(alias.name, alias.appid, true);
    for (const alternative of alias.aliases) {
      add(alternative, alias.appid, true);
    }
  }

  return {
    match(text: string): GameMention[] {
      const normalized = normalizeName(text);
      if (!normalized) return [];
      const words = normalized.split(' ');
      const found: GameMention[] = [];
      const seen = new Set<string>();

      for (let start = 0; start < words.length; start++) {
        const maxEnd = Math.min(start + 10, words.length);
        for (let end = maxEnd; end > start; end--) {
          const key = words.slice(start, end).join(' ');
          const candidate = candidates.get(key);
          if (!candidate) continue;
          const dedupeKey = candidate.appid != null ? `appid:${candidate.appid}` : `name:${candidate.key}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            found.push({ name: candidate.name, appid: candidate.appid });
          }
          start = end - 1;
          break;
        }
        if (found.length >= 6) break;
      }

      return found;
    },
  };
}

const BOLD_NAME_SKIP = /^(note|fixed|fixes|added|improved|updated|removed|now playable|newly playable|features?|bug fixes?|changes?|thanks)\b/i;

export function extractBoldGameNames(markdown: string, matcher: GameMatcher): GameMention[] {
  const names: GameMention[] = [];
  for (const match of markdown.matchAll(/(?:\*\*|__)([^*_\n]{2,80})(?:\*\*|__)/g)) {
    const raw = match[1];
    if (!raw) continue;
    const name = cleanMarkdown(raw);
    if (!name || name.length < 3 || name.length > 80) continue;
    if (BOLD_NAME_SKIP.test(name)) continue;
    if (name.split(/\s+/).length > 9) continue;
    if (/[.!?]$/.test(name)) continue;
    const matched = matcher.match(name);
    if (matched.length > 0) {
      names.push(matched[0]!);
    } else {
      names.push({ name, appid: null });
    }
  }
  return uniqueBy(names, (item) => (item.appid != null ? `appid:${item.appid}` : `name:${item.name.toLowerCase()}`));
}

export function createEmptyFlags(): CategoryFlags {
  return {
    feature: false,
    bugfix: false,
    compat: false,
    performance: false,
    anticheat: false,
    newlyPlayable: false,
    discussion: false,
  };
}

export interface Classification {
  flags: CategoryFlags;
  category: CategoryKey;
  categories: CategoryKey[];
}

const RE_ANTICHEAT = /\b(?:anti[- ]?cheat|easy anti[- ]?cheat|eac|battleye|gameguard|vanguard|denuvo)\b/i;
const RE_NEWLY_PLAYABLE = /\b(?:now playable|newly playable|playable again|previously worked)\b/i;
const RE_BUGFIX =
  /\b(?:fix|fixes|fixed|crash|crashes|crashed|hang|hangs|freeze|freezes|regression|regressions|resolve|resolved|workaround|worked around|no longer|broken|incorrect|wrong|flicker|black screen|stutter|leak|deadlock|softlock|corrupt)\b/i;
const RE_FEATURE =
  /\b(?:add|adds|added|support|supports|supported|implement|implements|implemented|new|enable|enables|enabled|expose|exposes|allow|allows|introduc(?:e|es|ed|ing)|improve|improves|improved|update|updates|updated)\b/i;
const RE_PERFORMANCE = /\b(?:performance|fps|framerate|frame time|frametime|stutter|latency|memory|cpu|gpu|shader)\b/i;
const RE_COMPAT =
  /\b(?:game|games|launcher|steam deck|controller|hdr|vulkan|directx|d3d|opengl|fullscreen|alt\+tab|display|resolution|audio|video playback)\b/i;

export function classifyText(
  text: string,
  options: { kind?: NewsKind; games?: GameMention[] } = {},
): Classification {
  const flags = createEmptyFlags();
  const games = options.games ?? [];
  const isDiscussion = options.kind === 'discussion';

  flags.anticheat = RE_ANTICHEAT.test(text);
  flags.newlyPlayable = RE_NEWLY_PLAYABLE.test(text);
  flags.bugfix = !isDiscussion && RE_BUGFIX.test(text);
  flags.feature = !isDiscussion && (RE_FEATURE.test(text) || flags.newlyPlayable);
  flags.performance = !isDiscussion && RE_PERFORMANCE.test(text);
  flags.compat = flags.anticheat || flags.newlyPlayable || games.length > 0 || RE_COMPAT.test(text);
  flags.discussion = isDiscussion;

  let category: CategoryKey = 'other';
  if (flags.newlyPlayable) category = 'newly-playable';
  else if (flags.anticheat) category = 'anticheat';
  else if (isDiscussion) category = 'discussion';
  else if (flags.bugfix) category = 'bugfix';
  else if (flags.feature) category = 'feature';
  else if (flags.performance) category = 'performance';
  else if (flags.compat) category = 'compat';

  return { flags, category, categories: categoriesForFlags(flags, options.kind) };
}

export function categoriesForFlags(flags: CategoryFlags, kind?: NewsKind): CategoryKey[] {
  const categories: CategoryKey[] = [];
  if (kind === 'release') categories.push('release');
  if (flags.newlyPlayable) categories.push('newly-playable');
  if (flags.feature) categories.push('feature');
  if (flags.bugfix) categories.push('bugfix');
  if (flags.compat) categories.push('compat');
  if (flags.performance) categories.push('performance');
  if (flags.anticheat) categories.push('anticheat');
  if (flags.discussion) categories.push('discussion');
  if (categories.length === 0) categories.push('other');
  return [...new Set(categories)];
}

export function aggregateFlags(entries: { flags: CategoryFlags }[]): CategoryFlags {
  const flags = createEmptyFlags();
  for (const entry of entries) {
    flags.feature ||= entry.flags.feature;
    flags.bugfix ||= entry.flags.bugfix;
    flags.compat ||= entry.flags.compat;
    flags.performance ||= entry.flags.performance;
    flags.anticheat ||= entry.flags.anticheat;
    flags.newlyPlayable ||= entry.flags.newlyPlayable;
    flags.discussion ||= entry.flags.discussion;
  }
  return flags;
}
