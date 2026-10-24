import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig, SourceConfig } from './types';

if (process.env.NODE_ENV !== 'test') {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
}

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const SOURCE_DEFINITIONS: SourceConfig[] = [
  {
    id: 'winehq',
    name: 'WineHQ',
    kind: 'gitlab-releases',
    homepage: 'https://gitlab.winehq.org/wine/wine/-/releases',
    url: 'https://gitlab.winehq.org/api/v4/projects/wine%2Fwine/releases?per_page=12',
    cadence: 'news',
    enabled: true,
    maxItems: 6,
  },
  {
    id: 'proton',
    name: 'Proton (Valve)',
    kind: 'github-releases',
    homepage: 'https://github.com/ValveSoftware/Proton/releases',
    repo: 'ValveSoftware/Proton',
    cadence: 'news',
    enabled: true,
    maxItems: 6,
  },
  {
    id: 'ge-proton',
    name: 'GE-Proton',
    kind: 'github-releases',
    homepage: 'https://github.com/GloriousEggroll/proton-ge-custom/releases',
    repo: 'GloriousEggroll/proton-ge-custom',
    cadence: 'news',
    enabled: true,
    maxItems: 6,
  },
  {
    id: 'dxvk',
    name: 'DXVK',
    kind: 'github-releases',
    homepage: 'https://github.com/doitsujin/dxvk/releases',
    repo: 'doitsujin/dxvk',
    cadence: 'news',
    enabled: true,
    maxItems: 4,
  },
  {
    id: 'vkd3d-proton',
    name: 'VKD3D-Proton',
    kind: 'github-releases',
    homepage: 'https://github.com/HansKristian-Work/vkd3d-proton/releases',
    repo: 'HansKristian-Work/vkd3d-proton',
    cadence: 'news',
    enabled: true,
    maxItems: 4,
  },
  {
    id: 'gamingonlinux',
    name: 'GamingOnLinux',
    kind: 'rss',
    homepage: 'https://www.gamingonlinux.com/',
    url: 'https://www.gamingonlinux.com/article_rss.php',
    cadence: 'news',
    enabled: true,
    maxItems: 20,
    exclude: /\b(?:humble bundle|fanatical|giveaway|review|sale|deal)\b/i,
    include:
      /\b(?:wine|proton|ge-proton|proton-cachyos|steam deck|steamdeck|steam machine|steam frame|steam play|steamos|dxvk|vkd3d|anti[- ]?cheat|valve)\b/i,
    includeCategories: [
      'Wine',
      'Steam Deck',
      'Steam Machine',
      'Steam Frame',
      'SteamOS',
      'Anti-Cheat',
      'GE-Proton',
    ],
  },
  {
    id: 'phoronix',
    name: 'Phoronix',
    kind: 'rss',
    homepage: 'https://www.phoronix.com/',
    url: 'https://www.phoronix.com/rss.php',
    cadence: 'news',
    enabled: true,
    maxItems: 20,
    include: /\b(?:wine|proton|valve|steam|dxvk|vkd3d|steamos|steam deck)\b/i,
  },
  {
    id: 'boilingsteam',
    name: 'BoilingSteam',
    kind: 'rss',
    homepage: 'https://boilingsteam.com/',
    url: 'https://boilingsteam.com/feed/',
    cadence: 'news',
    enabled: true,
    maxItems: 12,
    exclude: /\b(?:review|preview|interview)\b/i,
    include:
      /\b(?:wine|proton|steam deck|steam play|steam machine|steam frame|steamos|dxvk|vkd3d|anti[- ]?cheat|valve)\b/i,
  },
  {
    id: 'reddit',
    name: 'r/linux_gaming',
    kind: 'reddit',
    homepage: 'https://www.reddit.com/r/linux_gaming/',
    url: 'https://www.reddit.com/r/linux_gaming/search.rss?q=proton%20OR%20wine&restrict_sr=1&sort=new',
    cadence: 'news',
    enabled: true,
    maxItems: 12,
    userAgent: BROWSER_UA,
  },
  {
    id: 'steam',
    name: 'Steam',
    kind: 'steam',
    homepage: 'https://store.steampowered.com/',
    cadence: 'compatibility',
    enabled: true,
  },
  {
    id: 'protondb',
    name: 'ProtonDB',
    kind: 'protondb',
    homepage: 'https://www.protondb.com/',
    cadence: 'compatibility',
    enabled: true,
  },
  {
    id: 'awa',
    name: 'Are We Anti-Cheat Yet',
    kind: 'awa',
    homepage: 'https://areweanticheatyet.com/',
    url: 'https://raw.githubusercontent.com/AreWeAntiCheatYet/AreWeAntiCheatYet/master/games.json',
    cadence: 'anti-cheat',
    enabled: true,
  },
];

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const dataDir = path.resolve(
    process.cwd(),
    overrides.dataDir ?? process.env.DATA_DIR ?? 'data',
  );
  const port = overrides.port ?? numberFromEnv(process.env.PORT, 4320);
  const githubToken =
    overrides.githubToken !== undefined
      ? overrides.githubToken
      : process.env.GITHUB_TOKEN?.trim() || null;

  return {
    port,
    host: overrides.host ?? process.env.HOST ?? '127.0.0.1',
    dataDir,
    dbPath: overrides.dbPath ?? path.join(dataDir, 'pulse.db'),
    newsRefreshMinutes:
      overrides.newsRefreshMinutes ??
      numberFromEnv(process.env.NEWS_REFRESH_MINUTES, 30),
    gamesRefreshHours:
      overrides.gamesRefreshHours ?? numberFromEnv(process.env.GAMES_REFRESH_HOURS, 6),
    awaRefreshHours:
      overrides.awaRefreshHours ?? numberFromEnv(process.env.AWA_REFRESH_HOURS, 24),
    manualRefreshCooldownSeconds:
      overrides.manualRefreshCooldownSeconds ??
      numberFromEnv(process.env.MANUAL_REFRESH_COOLDOWN_SECONDS, 60),
    httpTimeoutMs:
      overrides.httpTimeoutMs ?? numberFromEnv(process.env.HTTP_TIMEOUT_MS, 20_000),
    githubToken,
    disableScheduler:
      overrides.disableScheduler ??
      booleanFromEnv(process.env.DISABLE_SCHEDULER, false),
    userAgent: overrides.userAgent ?? 'WineProtonPulse/1.0 (local dashboard)',
    sources: overrides.sources ?? SOURCE_DEFINITIONS,
    isProduction: overrides.isProduction ?? process.env.NODE_ENV === 'production',
  };
}

export function getSource(config: AppConfig, id: string): SourceConfig {
  const source = config.sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source: ${id}`);
  return source;
}
