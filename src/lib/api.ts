import type {
  CompatEventDto,
  FeedResponse,
  GameDetailResponse,
  GameSearchResponse,
  GamesResponse,
  NewsItemDto,
  RefreshResponse,
  ReleaseResponse,
  SourceDto,
  StatsDto,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly payload: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with HTTP ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

export interface FeedParams {
  category?: string;
  source?: string | null;
  q?: string | null;
  range?: string;
  game?: number | null;
  limit?: number;
  offset?: number;
}

export function fetchFeed(params: FeedParams, signal?: AbortSignal): Promise<FeedResponse> {
  return request<FeedResponse>(`/api/feed${queryString({ ...params })}`, { signal });
}

export function fetchItem(id: string, signal?: AbortSignal): Promise<NewsItemDto> {
  return request<NewsItemDto>(`/api/feed/${encodeURIComponent(id)}`, { signal });
}

export function fetchReleases(signal?: AbortSignal): Promise<ReleaseResponse> {
  return request<ReleaseResponse>('/api/releases', { signal });
}

export interface GamesParams {
  q?: string | null;
  tier?: string | null;
  sort?: string;
  featured?: boolean;
  appids?: number[];
  limit?: number;
  offset?: number;
}

export function fetchGames(params: GamesParams, signal?: AbortSignal): Promise<GamesResponse> {
  return request<GamesResponse>(
    `/api/games${queryString({
      ...params,
      appids: params.appids && params.appids.length > 0 ? params.appids.join(',') : null,
      featured: params.featured ? 1 : null,
    })}`,
    { signal },
  );
}

export function searchGames(q: string, signal?: AbortSignal): Promise<GameSearchResponse> {
  return request<GameSearchResponse>(`/api/games/search${queryString({ q })}`, { signal });
}

export function fetchGame(appid: number, signal?: AbortSignal): Promise<GameDetailResponse> {
  return request<GameDetailResponse>(`/api/games/${appid}`, { signal });
}

export function fetchStats(signal?: AbortSignal): Promise<StatsDto> {
  return request<StatsDto>('/api/stats', { signal });
}

export function fetchSources(signal?: AbortSignal): Promise<{ items: SourceDto[] }> {
  return request<{ items: SourceDto[] }>('/api/sources', { signal });
}

export function fetchCompatEvents(
  limit = 20,
  signal?: AbortSignal,
): Promise<{ items: CompatEventDto[] }> {
  return request<{ items: CompatEventDto[] }>(`/api/compat/events${queryString({ limit })}`, {
    signal,
  });
}

export function triggerRefresh(): Promise<RefreshResponse> {
  return request<RefreshResponse>('/api/refresh', { method: 'POST' });
}
