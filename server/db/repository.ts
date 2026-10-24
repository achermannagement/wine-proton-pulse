import type { Client, InValue, Row } from '@libsql/client';
import type {
  AnticheatDto,
  CategoryFlags,
  CategoryKey,
  CompatEventDto,
  FeedCounts,
  GameDetailResponse,
  GameDto,
  GameHistoryPoint,
  GameMention,
  NewsEntryDto,
  NewsItemDto,
  NewsKind,
  ProtonTier,
  SourceDto,
  SourceKind,
} from '../../shared/types';
import type { AwaGameInput, GameRecordInput, NewsItemInput, SourceConfig } from '../types';
import { categoriesForFlags } from '../lib/classify';
import { makeId } from '../lib/hash';
import { dayStartSeconds } from '../lib/time';
import { nameKey } from '../lib/text';

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseFlags(row: Row): CategoryFlags {
  return {
    feature: Boolean(row.has_feature),
    bugfix: Boolean(row.has_bugfix),
    compat: Boolean(row.has_compat),
    performance: Boolean(row.has_performance),
    anticheat: Boolean(row.has_anticheat),
    newlyPlayable: Boolean(row.has_newly_playable),
    discussion: Boolean(row.has_discussion),
  };
}

function mapGameMentions(value: unknown): GameMention[] {
  return parseJson<GameMention[]>(value, []).filter(
    (item): item is GameMention =>
      Boolean(item) && typeof item.name === 'string' && item.name.length > 0,
  );
}

function mapEntry(row: Row): NewsEntryDto {
  const flags = parseFlags(row);
  const category = (row.category as CategoryKey | null) ?? 'other';
  return {
    id: String(row.id),
    section: row.section == null ? null : String(row.section),
    text: String(row.text),
    category,
    categories: categoriesForFlags(flags),
    games: mapGameMentions(row.games),
    externalUrl: row.external_url == null ? null : String(row.external_url),
  };
}

function mapNewsItem(row: Row, entries: NewsEntryDto[] = []): NewsItemDto {
  const kind = String(row.kind) as NewsKind;
  const flags = parseFlags(row);
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    sourceName: String(row.source_name),
    kind,
    title: String(row.title),
    url: String(row.url),
    summary: row.summary == null ? null : String(row.summary),
    author: row.author == null ? null : String(row.author),
    version: row.version == null ? null : String(row.version),
    publishedAt: row.published_at == null ? null : Number(row.published_at),
    discoveredAt: Number(row.discovered_at),
    categories: categoriesForFlags(flags, kind),
    games: mapGameMentions(row.games),
    flags,
    entryCount: Number(row.entry_count ?? entries.length ?? 0),
    entries,
  };
}

function mapGame(row: Row): GameDto {
  return {
    appid: Number(row.appid),
    name: String(row.name),
    headerImage: row.header_image == null ? null : String(row.header_image),
    storeUrl: row.store_url == null ? null : String(row.store_url),
    tier: row.tier == null ? null : (String(row.tier) as ProtonTier),
    trendingTier: row.trending_tier == null ? null : (String(row.trending_tier) as ProtonTier),
    bestTier: row.best_tier == null ? null : (String(row.best_tier) as ProtonTier),
    score: row.score == null ? null : Number(row.score),
    confidence: row.confidence == null ? null : String(row.confidence),
    reports: row.reports == null ? null : Number(row.reports),
    isNative: Boolean(row.is_native),
    featured: Boolean(row.featured),
    previousTier: row.previous_tier == null ? null : (String(row.previous_tier) as ProtonTier),
    tierChangedAt: row.tier_changed_at == null ? null : Number(row.tier_changed_at),
    fetchedAt: Number(row.fetched_at),
    releaseDate: row.release_date == null ? null : String(row.release_date),
    awaStatus: row.awa_status == null ? null : String(row.awa_status),
    awaAnticheats: parseJson<string[]>(row.awa_anticheats, []),
    awaNative: Boolean(row.awa_native),
    awaUrl: row.awa_url == null ? null : String(row.awa_url),
  };
}

function mapEvent(row: Row): CompatEventDto {
  return {
    id: String(row.id),
    appid: row.appid == null ? null : Number(row.appid),
    gameName: String(row.game_name),
    type: String(row.event_type) as CompatEventDto['type'],
    fromValue: row.from_value == null ? null : String(row.from_value),
    toValue: String(row.to_value),
    createdAt: Number(row.created_at),
    url: row.url == null ? null : String(row.url),
  };
}

function mapAnticheat(row: Row): AnticheatDto {
  return {
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    anticheats: parseJson<string[]>(row.anticheats, []),
    native: Boolean(row.native),
    notes: parseJson<{ text: string; url: string | null }[]>(row.notes, []),
    reference: row.reference == null ? null : String(row.reference),
    url: row.url == null ? null : String(row.url),
    updatedAt: row.updated_at == null ? null : Number(row.updated_at),
  };
}


export async function syncSourceDefinitions(db: Client, sources: SourceConfig[]): Promise<void> {
  const statements = sources.map((source) => ({
    sql: `INSERT INTO sources (id, name, kind, homepage, cadence, enabled)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            kind = excluded.kind,
            homepage = excluded.homepage,
            cadence = excluded.cadence,
            enabled = excluded.enabled`,
    args: [
      source.id,
      source.name,
      source.kind,
      source.homepage,
      source.cadence,
      source.enabled ? 1 : 0,
    ] as InValue[],
  }));
  if (statements.length > 0) await db.batch(statements, 'write');
}

export async function updateSourceSuccess(
  db: Client,
  id: string,
  data: { attemptedAt: number; durationMs: number; itemsFound: number; itemsNew: number },
): Promise<void> {
  await db.execute({
    sql: `UPDATE sources SET
            last_attempt_at = ?, last_success_at = ?, last_error = NULL,
            last_duration_ms = ?, items_found = ?, items_new = ?
          WHERE id = ?`,
    args: [data.attemptedAt, data.attemptedAt, data.durationMs, data.itemsFound, data.itemsNew, id],
  });
}

export async function updateSourceFailure(
  db: Client,
  id: string,
  data: { attemptedAt: number; durationMs: number; error: string },
): Promise<void> {
  await db.execute({
    sql: `UPDATE sources SET
            last_attempt_at = ?, last_error = ?, last_duration_ms = ?,
            items_found = 0, items_new = 0
          WHERE id = ?`,
    args: [data.attemptedAt, data.error.slice(0, 500), data.durationMs, id],
  });
}

export async function listSources(db: Client): Promise<SourceDto[]> {
  const result = await db.execute(
    `SELECT s.*, (SELECT COUNT(*) FROM news n WHERE n.source_id = s.id) AS item_count
     FROM sources s
     ORDER BY s.cadence, s.name`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind) as SourceKind,
    homepage: row.homepage == null ? null : String(row.homepage),
    cadence: String(row.cadence) as SourceDto['cadence'],
    enabled: Boolean(row.enabled),
    lastSuccessAt: row.last_success_at == null ? null : Number(row.last_success_at),
    lastAttemptAt: row.last_attempt_at == null ? null : Number(row.last_attempt_at),
    lastError: row.last_error == null ? null : String(row.last_error),
    lastDurationMs: row.last_duration_ms == null ? null : Number(row.last_duration_ms),
    itemsFound: Number(row.items_found ?? 0),
    itemCount: Number(row.item_count ?? 0),
  }));
}

export async function getSourceLastSuccess(db: Client, id: string): Promise<number | null> {
  const result = await db.execute({
    sql: 'SELECT last_success_at FROM sources WHERE id = ?',
    args: [id],
  });
  const value = result.rows[0]?.last_success_at;
  return value == null ? null : Number(value);
}

export async function getSourceItemsFound(db: Client, id: string): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT items_found FROM sources WHERE id = ?',
    args: [id],
  });
  return Number(result.rows[0]?.items_found ?? 0);
}

export async function getMeta(db: Client, key: string): Promise<string | null> {
  const result = await db.execute({ sql: 'SELECT value FROM meta WHERE key = ?', args: [key] });
  const value = result.rows[0]?.value;
  return value == null ? null : String(value);
}

export async function setMeta(db: Client, key: string, value: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [key, value],
  });
}


export async function upsertNewsItems(
  db: Client,
  items: NewsItemInput[],
  now: number,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const existing = await db.execute({
      sql: 'SELECT id FROM news WHERE id = ? LIMIT 1',
      args: [item.id],
    });
    const isNew = existing.rows.length === 0;
    if (isNew) inserted++;
    else updated++;

    const categories = categoriesForFlags(item.flags, item.kind);
    const statements = [
      {
        sql: `INSERT INTO news (
          id, source_id, source_name, kind, title, url, summary, author, version,
          published_at, discovered_at, updated_at,
          has_feature, has_bugfix, has_compat, has_performance, has_anticheat,
          has_newly_playable, has_discussion, categories, games, raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_id = excluded.source_id,
          source_name = excluded.source_name,
          kind = excluded.kind,
          title = excluded.title,
          url = excluded.url,
          summary = excluded.summary,
          author = excluded.author,
          version = excluded.version,
          published_at = COALESCE(excluded.published_at, news.published_at),
          updated_at = excluded.updated_at,
          has_feature = excluded.has_feature,
          has_bugfix = excluded.has_bugfix,
          has_compat = excluded.has_compat,
          has_performance = excluded.has_performance,
          has_anticheat = excluded.has_anticheat,
          has_newly_playable = excluded.has_newly_playable,
          has_discussion = excluded.has_discussion,
          categories = excluded.categories,
          games = excluded.games,
          raw = excluded.raw`,
        args: [
          item.id,
          item.sourceId,
          item.sourceName,
          item.kind,
          item.title,
          item.url,
          item.summary,
          item.author,
          item.version,
          item.publishedAt,
          item.discoveredAt,
          now,
          item.flags.feature ? 1 : 0,
          item.flags.bugfix ? 1 : 0,
          item.flags.compat ? 1 : 0,
          item.flags.performance ? 1 : 0,
          item.flags.anticheat ? 1 : 0,
          item.flags.newlyPlayable ? 1 : 0,
          item.flags.discussion ? 1 : 0,
          JSON.stringify(categories),
          JSON.stringify(item.games),
          item.raw ?? null,
        ] as InValue[],
      },
      {
        sql: 'DELETE FROM news_entries WHERE news_id = ?',
        args: [item.id] as InValue[],
      },
      {
        sql: 'DELETE FROM news_games WHERE news_id = ?',
        args: [item.id] as InValue[],
      },
      ...item.entries.map((entry, index) => ({
        sql: `INSERT INTO news_entries (
          id, news_id, idx, section, text, category,
          has_feature, has_bugfix, has_compat, has_performance, has_anticheat,
          has_newly_playable, games, external_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `${item.id}:${index}`,
          item.id,
          index,
          entry.section,
          entry.text,
          entry.category,
          entry.flags.feature ? 1 : 0,
          entry.flags.bugfix ? 1 : 0,
          entry.flags.compat ? 1 : 0,
          entry.flags.performance ? 1 : 0,
          entry.flags.anticheat ? 1 : 0,
          entry.flags.newlyPlayable ? 1 : 0,
          JSON.stringify(entry.games),
          entry.externalUrl,
        ] as InValue[],
      })),
      ...item.games
        .filter((game): game is GameMention & { appid: number } => game.appid != null)
        .map((game) => ({
          sql: 'INSERT OR IGNORE INTO news_games (news_id, appid, name) VALUES (?, ?, ?)',
          args: [item.id, game.appid, game.name] as InValue[],
        })),
    ];

    await db.batch(statements, 'write');
  }

  return { inserted, updated };
}

interface FeedFilters {
  category?: string | null;
  source?: string | null;
  q?: string | null;
  range?: string | null;
  game?: number | null;
  limit: number;
  offset: number;
}

function categoryCondition(category: string | null | undefined): string | null {
  switch (category) {
    case 'feature':
      return 'n.has_feature = 1';
    case 'gamefix':
      return 'n.has_bugfix = 1 AND n.has_compat = 1';
    case 'bugfix':
      return 'n.has_bugfix = 1';
    case 'compat':
      return 'n.has_compat = 1';
    case 'release':
      return "n.kind = 'release'";
    case 'discussion':
      return 'n.has_discussion = 1';
    case 'anticheat':
      return 'n.has_anticheat = 1';
    default:
      return null;
  }
}

function entryCategoryCondition(category: string | null | undefined): string {
  switch (category) {
    case 'feature':
      return 'AND e.has_feature = 1';
    case 'gamefix':
      return 'AND e.has_bugfix = 1 AND e.has_compat = 1';
    case 'bugfix':
      return 'AND e.has_bugfix = 1';
    case 'compat':
      return 'AND e.has_compat = 1';
    case 'anticheat':
      return 'AND e.has_anticheat = 1';
    default:
      return '';
  }
}

async function entriesForItems(
  db: Client,
  ids: string[],
  category: string | null | undefined,
  limitPerItem = 4,
): Promise<Map<string, NewsEntryDto[]>> {
  const map = new Map<string, NewsEntryDto[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT * FROM (
            SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.news_id ORDER BY e.idx) AS rn
            FROM news_entries e
            WHERE e.news_id IN (${placeholders}) ${entryCategoryCondition(category)}
          ) WHERE rn <= ${Math.max(1, limitPerItem)}
          ORDER BY news_id, idx`,
    args: ids,
  });
  for (const row of result.rows) {
    const newsId = String(row.news_id);
    const list = map.get(newsId) ?? [];
    list.push(mapEntry(row));
    map.set(newsId, list);
  }
  return map;
}

export async function queryFeed(
  db: Client,
  filters: FeedFilters,
  lastUpdated: number | null,
): Promise<{
  items: NewsItemDto[];
  total: number;
  counts: FeedCounts;
  limit: number;
  offset: number;
  hasMore: boolean;
  lastUpdated: number | null;
}> {
  const conditions: string[] = [];
  const args: InValue[] = [];

  const category = categoryCondition(filters.category);
  if (category) conditions.push(category);
  if (filters.source) {
    conditions.push('n.source_id = ?');
    args.push(filters.source);
  }
  if (filters.range === '24h' || filters.range === '7d' || filters.range === '30d') {
    const days = filters.range === '24h' ? 1 : filters.range === '7d' ? 7 : 30;
    conditions.push('COALESCE(n.published_at, n.discovered_at) >= ?');
    args.push(Math.floor(Date.now() / 1000) - days * 86_400);
  }
  if (filters.q) {
    conditions.push(
      '(n.title LIKE ? OR n.summary LIKE ? OR EXISTS (SELECT 1 FROM news_entries e WHERE e.news_id = n.id AND e.text LIKE ?))',
    );
    const like = `%${filters.q}%`;
    args.push(like, like, like);
  }
  if (filters.game != null) {
    conditions.push('EXISTS (SELECT 1 FROM news_games ng WHERE ng.news_id = n.id AND ng.appid = ?)');
    args.push(filters.game);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalResult = await db.execute({
    sql: `SELECT COUNT(*) AS total FROM news n ${where}`,
    args,
  });
  const total = Number(totalResult.rows[0]?.total ?? 0);

  const rowsResult = await db.execute({
    sql: `SELECT n.*, (SELECT COUNT(*) FROM news_entries e WHERE e.news_id = n.id) AS entry_count
          FROM news n
          ${where}
          ORDER BY COALESCE(n.published_at, n.discovered_at) DESC, n.id DESC
          LIMIT ? OFFSET ?`,
    args: [...args, filters.limit, filters.offset],
  });

  const rows = rowsResult.rows;
  const entriesMap = await entriesForItems(
    db,
    rows.map((row) => String(row.id)),
    filters.category,
  );
  const items = rows.map((row) => mapNewsItem(row, entriesMap.get(String(row.id)) ?? []));

  return {
    items,
    total,
    counts: await getFeedCounts(db),
    limit: filters.limit,
    offset: filters.offset,
    hasMore: filters.offset + items.length < total,
    lastUpdated,
  };
}

export async function getFeedCounts(db: Client): Promise<FeedCounts> {
  const result = await db.execute(
    `SELECT
       COUNT(*) AS all_count,
       COALESCE(SUM(has_feature), 0) AS features,
       COALESCE(SUM(CASE WHEN has_bugfix = 1 AND has_compat = 1 THEN 1 ELSE 0 END), 0) AS gamefixes,
       COALESCE(SUM(has_bugfix), 0) AS bugfixes,
       COALESCE(SUM(has_compat), 0) AS compat,
       COALESCE(SUM(CASE WHEN kind = 'release' THEN 1 ELSE 0 END), 0) AS releases,
       COALESCE(SUM(has_discussion), 0) AS discussions
     FROM news`,
  );
  const row = result.rows[0];
  return {
    all: Number(row?.all_count ?? 0),
    features: Number(row?.features ?? 0),
    gamefixes: Number(row?.gamefixes ?? 0),
    bugfixes: Number(row?.bugfixes ?? 0),
    compat: Number(row?.compat ?? 0),
    releases: Number(row?.releases ?? 0),
    discussions: Number(row?.discussions ?? 0),
  };
}

export async function getNewsItem(db: Client, id: string): Promise<NewsItemDto | null> {
  const result = await db.execute({
    sql: `SELECT n.*, (SELECT COUNT(*) FROM news_entries e WHERE e.news_id = n.id) AS entry_count
          FROM news n WHERE n.id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  const entries = await db.execute({
    sql: 'SELECT * FROM news_entries WHERE news_id = ? ORDER BY idx',
    args: [id],
  });
  return mapNewsItem(row, entries.rows.map(mapEntry));
}

export async function queryReleases(
  db: Client,
  lastUpdated: number | null,
  perSource = 3,
  limit = 24,
): Promise<{ latest: NewsItemDto[]; items: NewsItemDto[]; lastUpdated: number | null }> {
  const result = await db.execute({
    sql: `SELECT * FROM (
            SELECT n.*, (SELECT COUNT(*) FROM news_entries e WHERE e.news_id = n.id) AS entry_count,
              ROW_NUMBER() OVER (
                PARTITION BY n.source_id
                ORDER BY COALESCE(n.published_at, n.discovered_at) DESC
              ) AS source_rank
            FROM news n
            WHERE n.kind = 'release'
          ) WHERE source_rank <= ?
          ORDER BY COALESCE(published_at, discovered_at) DESC
          LIMIT ?`,
    args: [perSource, limit],
  });
  const entriesMap = await entriesForItems(
    db,
    result.rows.map((row) => String(row.id)),
    null,
    8,
  );
  const items = result.rows.map((row) => mapNewsItem(row, entriesMap.get(String(row.id)) ?? []));
  const seen = new Set<string>();
  const latest = items.filter((item) => {
    if (seen.has(item.sourceId)) return false;
    seen.add(item.sourceId);
    return true;
  });
  return { latest, items, lastUpdated };
}


export async function resetFeaturedGames(db: Client): Promise<void> {
  await db.execute('UPDATE games SET featured = 0 WHERE featured = 1');
}

export async function getGameRow(db: Client, appid: number): Promise<Row | null> {
  const result = await db.execute({ sql: 'SELECT * FROM games WHERE appid = ?', args: [appid] });
  return result.rows[0] ?? null;
}

export async function upsertGame(
  db: Client,
  game: GameRecordInput,
  now: number,
): Promise<{ created: boolean; tierChanged: boolean; previousTier: ProtonTier | null }> {
  const existing = await getGameRow(db, game.appid);
  const previousTier = existing?.tier == null ? null : (String(existing.tier) as ProtonTier);
  const tierChanged = Boolean(previousTier && game.tier && previousTier !== game.tier);
  const fetchedAt = game.fetchedAt || now;
  const discoveredAt = existing ? Number(existing.discovered_at) : fetchedAt;

  await db.execute({
    sql: `INSERT INTO games (
      appid, name, name_key, header_image, store_url, tier, trending_tier, best_tier,
      score, confidence, reports, is_native, featured, lookup, release_date,
      discovered_at, fetched_at, previous_tier, tier_changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(appid) DO UPDATE SET
      name = excluded.name,
      name_key = excluded.name_key,
      header_image = COALESCE(excluded.header_image, games.header_image),
      store_url = COALESCE(excluded.store_url, games.store_url),
      tier = excluded.tier,
      trending_tier = excluded.trending_tier,
      best_tier = excluded.best_tier,
      score = excluded.score,
      confidence = excluded.confidence,
      reports = excluded.reports,
      is_native = excluded.is_native,
      featured = excluded.featured,
      lookup = excluded.lookup,
      release_date = COALESCE(excluded.release_date, games.release_date),
      fetched_at = excluded.fetched_at,
      previous_tier = CASE
        WHEN games.tier IS NOT NULL AND excluded.tier IS NOT NULL AND games.tier <> excluded.tier
        THEN games.tier ELSE games.previous_tier END,
      tier_changed_at = CASE
        WHEN games.tier IS NOT NULL AND excluded.tier IS NOT NULL AND games.tier <> excluded.tier
        THEN excluded.fetched_at ELSE games.tier_changed_at END`,
    args: [
      game.appid,
      game.name,
      nameKey(game.name),
      game.headerImage,
      game.storeUrl,
      game.tier,
      game.trendingTier,
      game.bestTier,
      game.score,
      game.confidence,
      game.reports,
      game.isNative ? 1 : 0,
      game.featured ? 1 : 0,
      (existing ? Number(existing.lookup ?? 0) : 0) || (game.featured ? 0 : 1),
      game.releaseDate,
      discoveredAt,
      fetchedAt,
      previousTier,
      tierChanged ? fetchedAt : existing?.tier_changed_at ?? null,
    ],
  });

  const day = dayStartSeconds(now);
  await db.execute({
    sql: `INSERT INTO game_history (appid, day, tier, trending_tier, score, reports, captured_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(appid, day) DO UPDATE SET
            tier = excluded.tier,
            trending_tier = excluded.trending_tier,
            score = excluded.score,
            reports = excluded.reports,
            captured_at = excluded.captured_at`,
    args: [game.appid, day, game.tier, game.trendingTier, game.score, game.reports, now],
  });

  if (tierChanged && game.tier) {
    await insertCompatEvent(db, {
      appid: game.appid,
      gameName: game.name,
      type: 'tier-change',
      fromValue: previousTier,
      toValue: game.tier,
      createdAt: now,
      url: game.storeUrl,
    });
  }

  return { created: !existing, tierChanged, previousTier };
}

export async function insertCompatEvent(
  db: Client,
  event: Omit<CompatEventDto, 'id'>,
): Promise<void> {
  const id = makeId(
    'event',
    `${event.type}:${event.appid ?? event.gameName}:${event.fromValue ?? ''}:${event.toValue}:${event.createdAt}`,
  );
  await db.execute({
    sql: `INSERT OR IGNORE INTO compat_events
          (id, appid, game_name, event_type, from_value, to_value, created_at, url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      event.appid,
      event.gameName,
      event.type,
      event.fromValue,
      event.toValue,
      event.createdAt,
      event.url,
    ],
  });
}

export async function queryCompatEvents(db: Client, limit = 20): Promise<CompatEventDto[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM compat_events ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows.map(mapEvent);
}

interface GameFilters {
  q?: string | null;
  tier?: string | null;
  sort?: string | null;
  featured?: boolean;
  appids?: number[] | null;
  limit: number;
  offset: number;
}

export async function queryGames(
  db: Client,
  filters: GameFilters,
): Promise<{ items: GameDto[]; total: number; limit: number; offset: number; hasMore: boolean }> {
  const conditions: string[] = [];
  const args: InValue[] = [];

  if (filters.q) {
    conditions.push('(name LIKE ? OR name_key LIKE ?)');
    const like = `%${filters.q.toLowerCase()}%`;
    args.push(like, like);
  }
  if (filters.tier) {
    conditions.push('tier = ?');
    args.push(filters.tier);
  }
  if (filters.featured) conditions.push('featured = 1');
  if (filters.appids && filters.appids.length > 0) {
    conditions.push(`appid IN (${filters.appids.map(() => '?').join(', ')})`);
    args.push(...filters.appids);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalResult = await db.execute({
    sql: `SELECT COUNT(*) AS total FROM games ${where}`,
    args,
  });
  const total = Number(totalResult.rows[0]?.total ?? 0);

  let order = 'COALESCE(tier_changed_at, fetched_at) DESC';
  switch (filters.sort) {
    case 'tier':
      order = `CASE tier
        WHEN 'platinum' THEN 0 WHEN 'gold' THEN 1 WHEN 'silver' THEN 2
        WHEN 'bronze' THEN 3 WHEN 'borked' THEN 4 WHEN 'pending' THEN 5 ELSE 6 END,
        reports DESC NULLS LAST`;
      break;
    case 'name':
      order = 'name COLLATE NOCASE ASC';
      break;
    case 'reports':
      order = 'reports DESC NULLS LAST';
      break;
    case 'score':
      order = 'score DESC NULLS LAST';
      break;
    default:
      break;
  }

  const result = await db.execute({
    sql: `SELECT * FROM games ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    args: [...args, filters.limit, filters.offset],
  });
  const items = result.rows.map(mapGame);
  return {
    items,
    total,
    limit: filters.limit,
    offset: filters.offset,
    hasMore: filters.offset + items.length < total,
  };
}

export async function getGameDetail(db: Client, appid: number): Promise<GameDetailResponse | null> {
  const row = await getGameRow(db, appid);
  if (!row) return null;
  const game = mapGame(row);

  const historyResult = await db.execute({
    sql: 'SELECT * FROM game_history WHERE appid = ? ORDER BY day ASC LIMIT 60',
    args: [appid],
  });
  const history: GameHistoryPoint[] = historyResult.rows.map((point) => ({
    day: Number(point.day),
    tier: point.tier == null ? null : (String(point.tier) as ProtonTier),
    score: point.score == null ? null : Number(point.score),
    reports: point.reports == null ? null : Number(point.reports),
    trendingTier: point.trending_tier == null ? null : (String(point.trending_tier) as ProtonTier),
  }));

  const eventsResult = await db.execute({
    sql: 'SELECT * FROM compat_events WHERE appid = ? ORDER BY created_at DESC LIMIT 20',
    args: [appid],
  });

  const anticheatResult = await db.execute({
    sql: `SELECT * FROM anticheat
          WHERE appid = ? OR name_key = ?
          ORDER BY CASE WHEN appid = ? THEN 0 ELSE 1 END
          LIMIT 1`,
    args: [appid, nameKey(game.name), appid],
  });

  const relatedResult = await db.execute({
    sql: `SELECT n.*, (SELECT COUNT(*) FROM news_entries e WHERE e.news_id = n.id) AS entry_count
          FROM news n
          JOIN news_games ng ON ng.news_id = n.id
          WHERE ng.appid = ?
          ORDER BY COALESCE(n.published_at, n.discovered_at) DESC
          LIMIT 6`,
    args: [appid],
  });
  const entriesMap = await entriesForItems(
    db,
    relatedResult.rows.map((item) => String(item.id)),
    null,
    3,
  );

  return {
    game,
    history,
    events: eventsResult.rows.map(mapEvent),
    relatedNews: relatedResult.rows.map((item) =>
      mapNewsItem(item, entriesMap.get(String(item.id)) ?? []),
    ),
    anticheat: anticheatResult.rows[0] ? mapAnticheat(anticheatResult.rows[0]) : null,
  };
}


export async function upsertAwaGames(
  db: Client,
  games: AwaGameInput[],
  now: number,
): Promise<{ changed: number }> {
  const existingResult = await db.execute('SELECT id, status, appid, name, url FROM anticheat');
  const existing = new Map<string, Row>();
  for (const row of existingResult.rows) existing.set(String(row.id), row);

  let changed = 0;
  const statements = games.map((game) => {
    const before = existing.get(game.id);
    if (before && String(before.status) !== game.status) {
      changed++;
    }
    return {
      sql: `INSERT INTO anticheat (
        id, name, name_key, appid, status, anticheats, native, notes, reference, url, updated_at, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        name_key = excluded.name_key,
        appid = excluded.appid,
        status = excluded.status,
        anticheats = excluded.anticheats,
        native = excluded.native,
        notes = excluded.notes,
        reference = excluded.reference,
        url = excluded.url,
        updated_at = excluded.updated_at,
        fetched_at = excluded.fetched_at`,
      args: [
        game.id,
        game.name,
        game.nameKey,
        game.appid,
        game.status,
        JSON.stringify(game.anticheats),
        game.native ? 1 : 0,
        JSON.stringify(game.notes),
        game.reference,
        game.url,
        game.updatedAt,
        now,
      ] as InValue[],
    };
  });
  if (statements.length > 0) await db.batch(statements, 'write');

  for (const game of games) {
    const before = existing.get(game.id);
    if (before && String(before.status) !== game.status) {
      await insertCompatEvent(db, {
        appid: game.appid,
        gameName: game.name,
        type: 'anti-cheat-change',
        fromValue: String(before.status),
        toValue: game.status,
        createdAt: now,
        url: game.url,
      });
    }
  }

  await applyAwaToGames(db);
  return { changed };
}

export async function applyAwaToGames(db: Client): Promise<void> {
  const gamesResult = await db.execute('SELECT appid, name_key FROM games');
  if (gamesResult.rows.length === 0) return;
  const awaResult = await db.execute(
    'SELECT appid, name_key, status, anticheats, native, url, updated_at FROM anticheat',
  );
  const byAppid = new Map<number, Row>();
  const byName = new Map<string, Row>();
  for (const row of awaResult.rows) {
    if (row.appid != null) byAppid.set(Number(row.appid), row);
    const key = String(row.name_key);
    if (!byName.has(key)) byName.set(key, row);
  }

  const statements = gamesResult.rows.map((game) => {
    const match = byAppid.get(Number(game.appid)) ?? byName.get(String(game.name_key));
    return {
      sql: `UPDATE games SET
        awa_status = ?, awa_anticheats = ?, awa_native = ?, awa_url = ?, awa_updated_at = ?
        WHERE appid = ?`,
      args: [
        match ? String(match.status) : null,
        match ? String(match.anticheats) : '[]',
        match ? Number(match.native) : 0,
        match?.url == null ? null : String(match.url),
        match?.updated_at == null ? null : Number(match.updated_at),
        Number(game.appid),
      ] as InValue[],
    };
  });
  if (statements.length > 0) await db.batch(statements, 'write');
}

export async function getAnticheatForName(
  db: Client,
  appid: number | null,
  name: string,
): Promise<AnticheatDto | null> {
  const result = await db.execute({
    sql: `SELECT * FROM anticheat WHERE appid = ? OR name_key = ?
          ORDER BY CASE WHEN appid = ? THEN 0 ELSE 1 END LIMIT 1`,
    args: [appid, nameKey(name), appid],
  });
  return result.rows[0] ? mapAnticheat(result.rows[0]) : null;
}


export async function getSearchCache<T>(db: Client, key: string, maxAgeSeconds: number): Promise<T | null> {
  const result = await db.execute({
    sql: 'SELECT payload, fetched_at FROM search_cache WHERE query_key = ?',
    args: [key],
  });
  const row = result.rows[0];
  if (!row) return null;
  if (Date.now() / 1000 - Number(row.fetched_at) > maxAgeSeconds) return null;
  return parseJson<T>(row.payload, null as T);
}

export async function setSearchCache(db: Client, key: string, payload: unknown, now: number): Promise<void> {
  await db.execute({
    sql: `INSERT INTO search_cache (query_key, payload, fetched_at) VALUES (?, ?, ?)
          ON CONFLICT(query_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    args: [key, JSON.stringify(payload), now],
  });
}

export async function getGazetteer(
  db: Client,
): Promise<{ name: string; appid: number | null }[]> {
  const result = await db.execute(
    `SELECT name, appid FROM anticheat
     UNION ALL
     SELECT name, appid FROM games`,
  );
  return result.rows
    .filter((row) => typeof row.name === 'string' && String(row.name).length > 0)
    .map((row) => ({
      name: String(row.name),
      appid: row.appid == null ? null : Number(row.appid),
    }));
}

export async function getStatsCounts(db: Client): Promise<{
  news: number;
  releases: number;
  games: number;
  compatEvents: number;
}> {
  const result = await db.execute(
    `SELECT
      (SELECT COUNT(*) FROM news) AS news,
      (SELECT COUNT(*) FROM news WHERE kind = 'release') AS releases,
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM compat_events) AS compat_events`,
  );
  const row = result.rows[0];
  return {
    news: Number(row?.news ?? 0),
    releases: Number(row?.releases ?? 0),
    games: Number(row?.games ?? 0),
    compatEvents: Number(row?.compat_events ?? 0),
  };
}

export async function getLatestNewsUpdate(db: Client): Promise<number | null> {
  const result = await db.execute('SELECT MAX(updated_at) AS updated FROM news');
  const value = result.rows[0]?.updated;
  return value == null ? null : Number(value);
}

export async function insertFetchLog(
  db: Client,
  data: {
    source: string;
    startedAt: number;
    durationMs: number;
    itemsFound: number;
    itemsNew: number;
    error?: string | null;
  },
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO fetch_log (source, started_at, duration_ms, items_found, items_new, error)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      data.source,
      data.startedAt,
      data.durationMs,
      data.itemsFound,
      data.itemsNew,
      data.error ?? null,
    ],
  });
}

export async function pruneOldData(db: Client, now: number): Promise<void> {
  await db.batch(
    [
      {
        sql: 'DELETE FROM news WHERE COALESCE(published_at, discovered_at) < ?',
        args: [now - 180 * 86_400],
      },
      {
        sql: 'DELETE FROM game_history WHERE day < ?',
        args: [now - 120 * 86_400],
      },
      {
        sql: 'DELETE FROM compat_events WHERE created_at < ?',
        args: [now - 365 * 86_400],
      },
      {
        sql: 'DELETE FROM fetch_log WHERE started_at < ?',
        args: [now - 30 * 86_400],
      },
      {
        sql: 'DELETE FROM search_cache WHERE fetched_at < ?',
        args: [now - 7 * 86_400],
      },
    ],
    'write',
  );
}
