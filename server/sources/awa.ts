import type { AwaGameInput, SourceConfig } from '../types';
import type { SyncContext } from '../services/context';
import { nameKey, safeHttpUrl, truncate } from '../lib/text';
import { parseDateToEpoch } from '../lib/time';

interface AwaRawGame {
  name?: unknown;
  slug?: unknown;
  url?: unknown;
  status?: unknown;
  anticheats?: unknown;
  native?: unknown;
  notes?: unknown;
  reference?: unknown;
  dateChanged?: unknown;
  storeIds?: { steam?: unknown; [key: string]: unknown };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function parseNotes(value: unknown): { text: string; url: string | null }[] {
  if (!Array.isArray(value)) return [];
  const notes: { text: string; url: string | null }[] = [];
  for (const note of value.slice(0, 5)) {
    if (typeof note === 'string') {
      notes.push({ text: truncate(note, 400), url: null });
    } else if (Array.isArray(note) && typeof note[0] === 'string') {
      notes.push({
        text: truncate(note[0], 400),
        url: typeof note[1] === 'string' ? safeHttpUrl(note[1]) : null,
      });
    }
  }
  return notes;
}

export function parseAwaGames(value: unknown): AwaGameInput[] {
  if (!Array.isArray(value)) return [];
  const games: AwaGameInput[] = [];
  const seen = new Set<string>();

  for (const raw of value as AwaRawGame[]) {
    if (!raw || typeof raw !== 'object') continue;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    const key = nameKey(name);
    const slug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : key.replace(/\s+/g, '-');
    if (seen.has(slug)) continue;
    seen.add(slug);

    const steamId = raw.storeIds?.steam;
    const appid =
      typeof steamId === 'number'
        ? steamId
        : typeof steamId === 'string' && /^\d+$/.test(steamId)
          ? Number(steamId)
          : null;
    const status = typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim() : 'Unknown';
    const url =
      safeHttpUrl(typeof raw.url === 'string' ? raw.url : null) ??
      safeHttpUrl(`https://areweanticheatyet.com/?search=${encodeURIComponent(name)}`);

    games.push({
      id: slug,
      name: truncate(name, 200),
      nameKey: key,
      appid: appid != null && Number.isInteger(appid) && appid > 0 ? appid : null,
      status,
      anticheats: stringArray(raw.anticheats),
      native: Boolean(raw.native),
      notes: parseNotes(raw.notes),
      reference: typeof raw.reference === 'string' ? raw.reference : null,
      url,
      updatedAt: parseDateToEpoch(typeof raw.dateChanged === 'string' ? raw.dateChanged : null),
    });
  }

  return games;
}

export async function fetchAwaGames(
  ctx: SyncContext,
  source: SourceConfig,
): Promise<AwaGameInput[]> {
  if (!source.url) return [];
  const response = await ctx.http.getJson<unknown>(source.url, {
    accept: 'application/json',
  });
  return parseAwaGames(response.data);
}
