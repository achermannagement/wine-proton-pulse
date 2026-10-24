export type SourceKind =
  | 'gitlab-releases'
  | 'github-releases'
  | 'rss'
  | 'reddit'
  | 'steam'
  | 'protondb'
  | 'awa';

export type SourceCadence = 'news' | 'compatibility' | 'anti-cheat';

export type NewsKind = 'release' | 'article' | 'discussion';

export type ProtonTier =
  | 'platinum'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'borked'
  | 'pending'
  | 'unknown';

export type CategoryKey =
  | 'feature'
  | 'bugfix'
  | 'compat'
  | 'performance'
  | 'anticheat'
  | 'newly-playable'
  | 'release'
  | 'discussion'
  | 'other';

export interface GameMention {
  name: string;
  appid: number | null;
}

export interface CategoryFlags {
  feature: boolean;
  bugfix: boolean;
  compat: boolean;
  performance: boolean;
  anticheat: boolean;
  newlyPlayable: boolean;
  discussion: boolean;
}

export interface NewsEntryDto {
  id: string;
  section: string | null;
  text: string;
  category: CategoryKey;
  categories: CategoryKey[];
  games: GameMention[];
  externalUrl: string | null;
}

export interface NewsItemDto {
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
  categories: CategoryKey[];
  games: GameMention[];
  flags: CategoryFlags;
  entryCount: number;
  entries: NewsEntryDto[];
}

export interface FeedCounts {
  all: number;
  features: number;
  gamefixes: number;
  bugfixes: number;
  compat: number;
  releases: number;
  discussions: number;
}

export interface FeedResponse {
  items: NewsItemDto[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  lastUpdated: number | null;
  counts: FeedCounts;
}

export interface ReleaseResponse {
  latest: NewsItemDto[];
  items: NewsItemDto[];
  lastUpdated: number | null;
}

export interface GameDto {
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
  previousTier: ProtonTier | null;
  tierChangedAt: number | null;
  fetchedAt: number;
  releaseDate: string | null;
  awaStatus: string | null;
  awaAnticheats: string[];
  awaNative: boolean;
  awaUrl: string | null;
}

export interface GameHistoryPoint {
  day: number;
  tier: ProtonTier | null;
  score: number | null;
  reports: number | null;
  trendingTier: ProtonTier | null;
}

export interface CompatEventDto {
  id: string;
  appid: number | null;
  gameName: string;
  type: 'tier-change' | 'anti-cheat-change';
  fromValue: string | null;
  toValue: string;
  createdAt: number;
  url: string | null;
}

export interface AnticheatDto {
  id: string;
  name: string;
  status: string;
  anticheats: string[];
  native: boolean;
  notes: { text: string; url: string | null }[];
  reference: string | null;
  url: string | null;
  updatedAt: number | null;
}

export interface GameDetailResponse {
  game: GameDto;
  history: GameHistoryPoint[];
  events: CompatEventDto[];
  relatedNews: NewsItemDto[];
  anticheat: AnticheatDto | null;
}

export interface GamesResponse {
  items: GameDto[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface GameSearchResponse {
  items: GameDto[];
  query: string;
  remote: boolean;
}

export interface SourceDto {
  id: string;
  name: string;
  kind: SourceKind;
  homepage: string | null;
  cadence: SourceCadence;
  enabled: boolean;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
  lastDurationMs: number | null;
  itemsFound: number;
  itemCount: number;
}

export interface StatsDto {
  lastUpdated: number | null;
  nextRefreshAt: number | null;
  syncRunning: boolean;
  counts: {
    news: number;
    releases: number;
    games: number;
    compatEvents: number;
    sourcesHealthy: number;
    sourcesTotal: number;
  };
  feedCounts: FeedCounts;
  sources: SourceDto[];
  pulse: CompatEventDto[];
  latestReleases: NewsItemDto[];
}

export interface RefreshResponse {
  started: boolean;
  reason?: string;
  retryAfterMs?: number;
}
