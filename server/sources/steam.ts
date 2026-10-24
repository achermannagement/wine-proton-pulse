import type { SteamAppDetails, SteamFeaturedGame, SteamSearchResult } from '../types';
import type { SyncContext } from '../services/context';
import { safeHttpUrl, truncate, uniqueBy } from '../lib/text';

interface SteamFeaturedItem {
  id?: number;
  name?: string;
  header_image?: string;
  linux_available?: boolean;
  windows_available?: boolean;
  type?: string;
}

interface SteamFeaturedResponse {
  top_sellers?: { items?: SteamFeaturedItem[] };
  new_releases?: { items?: SteamFeaturedItem[] };
}

interface SteamSearchResponse {
  items?: {
    type?: string;
    name?: string;
    id?: number;
    tiny_image?: string;
    platforms?: { windows?: boolean; linux?: boolean; mac?: boolean };
  }[];
}

interface SteamAppDetailsResponse {
  [appid: string]: {
    success?: boolean;
    data?: {
      name?: string;
      header_image?: string;
      is_free?: boolean;
      release_date?: { date?: string; coming_soon?: boolean };
      platforms?: { windows?: boolean; linux?: boolean; mac?: boolean };
    };
  };
}

function storeUrl(appid: number): string {
  return `https://store.steampowered.com/app/${appid}/`;
}

export function parseSteamFeatured(data: SteamFeaturedResponse): SteamFeaturedGame[] {
  const candidates = [
    ...(data.top_sellers?.items ?? []),
    ...(data.new_releases?.items ?? []),
  ];
  const games: SteamFeaturedGame[] = [];
  for (const item of candidates) {
    const appid = Number(item.id);
    const name = truncate(item.name?.trim() ?? '', 200);
    if (!Number.isInteger(appid) || appid <= 0 || !name) continue;
    games.push({
      appid,
      name,
      headerImage: safeHttpUrl(item.header_image),
      storeUrl: storeUrl(appid),
      isNative: Boolean(item.linux_available),
    });
  }
  return uniqueBy(games, (game) => String(game.appid)).slice(0, 40);
}

export function parseSteamSearch(data: SteamSearchResponse): SteamSearchResult[] {
  const results: SteamSearchResult[] = [];
  for (const item of data.items ?? []) {
    const appid = Number(item.id);
    const name = truncate(item.name?.trim() ?? '', 200);
    if (!Number.isInteger(appid) || appid <= 0 || !name) continue;
    results.push({
      appid,
      name,
      image: safeHttpUrl(item.tiny_image),
      storeUrl: storeUrl(appid),
      platforms: {
        windows: Boolean(item.platforms?.windows),
        linux: Boolean(item.platforms?.linux),
        mac: Boolean(item.platforms?.mac),
      },
    });
  }
  return uniqueBy(results, (game) => String(game.appid)).slice(0, 8);
}

export function parseSteamAppDetails(
  data: SteamAppDetailsResponse,
  appid: number,
): SteamAppDetails | null {
  const entry = data[String(appid)];
  if (!entry?.success || !entry.data?.name) return null;
  return {
    appid,
    name: truncate(entry.data.name, 200),
    headerImage: safeHttpUrl(entry.data.header_image),
    storeUrl: storeUrl(appid),
    releaseDate: entry.data.release_date?.date ?? null,
    isNative: Boolean(entry.data.platforms?.linux),
  };
}

export async function fetchSteamFeatured(ctx: SyncContext): Promise<SteamFeaturedGame[]> {
  const response = await ctx.http.getJson<SteamFeaturedResponse>(
    'https://store.steampowered.com/api/featuredcategories?cc=us&l=en',
  );
  return parseSteamFeatured(response.data ?? {});
}

export async function fetchSteamSearch(
  ctx: SyncContext,
  query: string,
): Promise<SteamSearchResult[]> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
    query,
  )}&cc=us&l=en`;
  const response = await ctx.http.getJson<SteamSearchResponse>(url);
  return parseSteamSearch(response.data ?? {});
}

export async function fetchSteamAppDetails(
  ctx: SyncContext,
  appid: number,
): Promise<SteamAppDetails | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en`;
  const response = await ctx.http.getJson<SteamAppDetailsResponse>(url);
  return parseSteamAppDetails(response.data ?? {}, appid);
}
