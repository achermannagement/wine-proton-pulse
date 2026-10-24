import type {
  CategoryFlags,
  CategoryKey,
  GameMention,
  NewsKind,
  ProtonTier,
  SourceCadence,
  SourceKind,
} from '../shared/types';

export interface SourceConfig {
  id: string;
  name: string;
  kind: SourceKind;
  homepage: string;
  cadence: SourceCadence;
  enabled: boolean;
  url?: string;
  repo?: string;
  maxItems?: number;
  include?: RegExp;
  exclude?: RegExp;
  includeCategories?: string[];
  userAgent?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  newsRefreshMinutes: number;
  gamesRefreshHours: number;
  awaRefreshHours: number;
  manualRefreshCooldownSeconds: number;
  httpTimeoutMs: number;
  githubToken: string | null;
  disableScheduler: boolean;
  userAgent: string;
  sources: SourceConfig[];
  isProduction: boolean;
}

export interface NewsEntryInput {
  section: string | null;
  text: string;
  category: CategoryKey;
  flags: CategoryFlags;
  games: GameMention[];
  externalUrl: string | null;
}

export interface NewsItemInput {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: NewsKind;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  version: string | null;
  publishedAt: number | null;
  discoveredAt: number;
  flags: CategoryFlags;
  games: GameMention[];
  entries: NewsEntryInput[];
  raw?: string | null;
}

export interface GameRecordInput {
  appid: number;
  name: string;
  headerImage: string | null;
  storeUrl: string | null;
  tier: ProtonTier | null;
  trendingTier: ProtonTier | null;
  bestTier: ProtonTier | null;
  score: number | null;
  confidence: string | null;
  reports: number | null;
  isNative: boolean;
  featured: boolean;
  releaseDate: string | null;
  fetchedAt: number;
}

export interface AwaGameInput {
  id: string;
  name: string;
  nameKey: string;
  appid: number | null;
  status: string;
  anticheats: string[];
  native: boolean;
  notes: { text: string; url: string | null }[];
  reference: string | null;
  url: string | null;
  updatedAt: number | null;
}

export interface ProtonDbSummary {
  tier: ProtonTier;
  trendingTier: ProtonTier | null;
  bestTier: ProtonTier | null;
  score: number | null;
  confidence: string | null;
  total: number | null;
}

export interface SteamFeaturedGame {
  appid: number;
  name: string;
  headerImage: string | null;
  storeUrl: string;
  isNative: boolean;
}

export interface SteamSearchResult {
  appid: number;
  name: string;
  image: string | null;
  storeUrl: string;
  platforms: { windows: boolean; linux: boolean; mac: boolean };
}

export interface SteamAppDetails {
  appid: number;
  name: string;
  headerImage: string | null;
  storeUrl: string;
  releaseDate: string | null;
  isNative: boolean;
}
