import { Agent, fetch, type Dispatcher, type RequestInit as UndiciRequestInit } from 'undici';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  etag?: string | null;
  timeoutMs?: number;
  accept?: string;
  userAgent?: string;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  notModified: boolean;
  body: string;
  etag: string | null;
  contentType: string | null;
}

export interface JsonResponse<T> {
  status: number;
  notModified: boolean;
  data: T | null;
  etag: string | null;
}

export interface HttpClient {
  getText(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
  getJson<T = unknown>(url: string, options?: HttpRequestOptions): Promise<JsonResponse<T>>;
}

interface HttpClientConfig {
  timeoutMs: number;
  userAgent: string;
  githubToken?: string | null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 10_000);
  return null;
}

function isGitHubApi(url: string): boolean {
  try {
    return new URL(url).hostname === 'api.github.com';
  } catch {
    return false;
  }
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const dispatcher: Dispatcher = new Agent({ connect: { timeout: 25_000 } });

  async function request(url: string, options: HttpRequestOptions = {}, attempts = 3): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      Accept: options.accept ?? '*/*',
      'User-Agent': options.userAgent ?? config.userAgent,
      'Accept-Language': 'en-US,en;q=0.8',
      ...options.headers,
    };
    if (options.etag) headers['If-None-Match'] = options.etag;
    if (config.githubToken && isGitHubApi(url) && !headers.Authorization) {
      headers.Authorization = `Bearer ${config.githubToken}`;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const requestOptions: UndiciRequestInit = {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(options.timeoutMs ?? config.timeoutMs),
          dispatcher,
        };
        const response = await fetch(url, requestOptions);
        const etag = response.headers.get('etag');
        const contentType = response.headers.get('content-type');

        if (response.status === 304) {
          return { status: 304, ok: true, notModified: true, body: '', etag, contentType };
        }

        const body = await response.text();

        if (response.status === 429 || response.status >= 500) {
          if (attempt < attempts - 1) {
            const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
            const delay = retryAfter ?? Math.min(500 * 2 ** attempt + Math.random() * 250, 5_000);
            console.warn(`[http] ${response.status} ${url} — retrying in ${Math.round(delay)}ms`);
            await sleep(delay);
            continue;
          }
        }

        if (!response.ok) {
          const remaining = response.headers.get('x-ratelimit-remaining');
          const suffix = remaining === '0' ? ' (rate limit exhausted)' : '';
          throw new HttpError(
            response.status,
            url,
            `HTTP ${response.status} from ${url}${suffix}: ${body.slice(0, 240)}`,
          );
        }

        return {
          status: response.status,
          ok: true,
          notModified: false,
          body,
          etag,
          contentType,
        };
      } catch (error) {
        lastError = error;
        if (error instanceof HttpError) throw error;
        if (attempt >= attempts - 1) break;
        const delay = Math.min(500 * 2 ** attempt + Math.random() * 250, 5_000);
        console.warn(`[http] request failed ${url} — retrying in ${Math.round(delay)}ms`);
        await sleep(delay);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
  }

  return {
    async getText(url, options) {
      return request(url, options);
    },
    async getJson<T>(url: string, options?: HttpRequestOptions): Promise<JsonResponse<T>> {
      const response = await request(url, {
        ...options,
        accept: options?.accept ?? 'application/json',
      });
      if (response.notModified) {
        return { status: response.status, notModified: true, data: null, etag: response.etag };
      }
      try {
        return {
          status: response.status,
          notModified: false,
          data: JSON.parse(response.body) as T,
          etag: response.etag,
        };
      } catch {
        throw new Error(`Invalid JSON from ${url}`);
      }
    },
  };
}
