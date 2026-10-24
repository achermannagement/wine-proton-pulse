import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HttpClient, HttpRequestOptions, HttpResponse, JsonResponse } from '../../lib/http';
import { HttpError } from '../../lib/http';

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

const TEXT_FILES: { match: RegExp; file: string }[] = [
  { match: /gamingonlinux\.com\/article_rss\.php/, file: 'rss-gol.xml' },
  { match: /phoronix\.com\/rss\.php/, file: 'rss-phoronix.xml' },
  { match: /boilingsteam\.com\/feed\//, file: 'rss-boilingsteam.xml' },
  { match: /reddit\.com\/r\/linux_gaming/, file: 'rss-reddit.xml' },
];

const JSON_FILES: { match: RegExp; file: string }[] = [
  { match: /gitlab\.winehq\.org\/api\/v4\/projects\/wine%2Fwine\/releases/, file: 'wine-releases.json' },
  { match: /api\.github\.com\/repos\/ValveSoftware\/Proton\/releases/, file: 'github-proton.json' },
  { match: /api\.github\.com\/repos\/GloriousEggroll\/proton-ge-custom\/releases/, file: 'github-ge.json' },
  { match: /api\.github\.com\/repos\/doitsujin\/dxvk\/releases/, file: 'github-dxvk.json' },
  { match: /api\.github\.com\/repos\/HansKristian-Work\/vkd3d-proton\/releases/, file: 'github-vkd3d.json' },
  { match: /store\.steampowered\.com\/api\/featuredcategories/, file: 'steam-featured.json' },
  { match: /store\.steampowered\.com\/api\/storesearch/, file: 'steam-search.json' },
  { match: /raw\.githubusercontent\.com\/AreWeAntiCheatYet\/AreWeAntiCheatYet\/master\/games\.json/, file: 'awa-games.json' },
];

function read(file: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
}

export interface FixtureHttpClient extends HttpClient {
  requests: string[];
}

export function createFixtureHttpClient(): FixtureHttpClient {
  const requests: string[] = [];

  function textFor(url: string): string | null {
    for (const entry of TEXT_FILES) {
      if (entry.match.test(url)) return read(entry.file);
    }
    return null;
  }

  function jsonFor(url: string): unknown | null {
    for (const entry of JSON_FILES) {
      if (entry.match.test(url)) return JSON.parse(read(entry.file));
    }
    if (/store\.steampowered\.com\/api\/appdetails/.test(url)) {
      const appid = Number(/appids=(\d+)/.exec(url)?.[1] ?? '0');
      const featured = JSON.parse(read('steam-featured.json')) as {
        top_sellers?: { items?: { id: number; name: string; header_image: string; linux_available?: boolean }[] };
        new_releases?: { items?: { id: number; name: string; header_image: string; linux_available?: boolean }[] };
      };
      const items = [...(featured.top_sellers?.items ?? []), ...(featured.new_releases?.items ?? [])];
      const item = items.find((candidate) => candidate.id === appid);
      if (item) {
        return {
          [appid]: {
            success: true,
            data: {
              name: item.name,
              header_image: item.header_image,
              release_date: { date: '', coming_soon: false },
              platforms: { windows: true, linux: Boolean(item.linux_available), mac: false },
            },
          },
        };
      }
      return { [appid]: { success: false } };
    }
    if (/www\.protondb\.com\/api\/v1\/reports\/summaries\/(\d+)\.json/.test(url)) {
      const appid = /summaries\/(\d+)\.json/.exec(url)?.[1] ?? '';
      const summaries = JSON.parse(read('protondb-summaries.json')) as Record<string, unknown>;
      const summary = summaries[appid];
      if (!summary) throw new HttpError(404, url, `No ProtonDB fixture for ${appid}`);
      return summary;
    }
    return null;
  }

  return {
    requests,
    async getText(url: string, _options?: HttpRequestOptions): Promise<HttpResponse> {
      requests.push(url);
      const body = textFor(url);
      if (body == null) throw new HttpError(404, url, `No text fixture for ${url}`);
      return {
        status: 200,
        ok: true,
        notModified: false,
        body,
        etag: null,
        contentType: url.includes('rss') ? 'application/rss+xml' : 'text/plain',
      };
    },
    async getJson<T>(url: string, _options?: HttpRequestOptions): Promise<JsonResponse<T>> {
      requests.push(url);
      const data = jsonFor(url);
      if (data == null) throw new HttpError(404, url, `No JSON fixture for ${url}`);
      return { status: 200, notModified: false, data: data as T, etag: null };
    },
  };
}
