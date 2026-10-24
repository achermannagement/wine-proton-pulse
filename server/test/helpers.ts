import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from '@libsql/client';
import { configureDb, openDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { loadConfig } from '../config';
import { createGameMatcher, type GameMatcher } from '../lib/classify';
import { createFixtureHttpClient } from './fixtures/fixture-http';
import type { HttpClient, HttpRequestOptions, HttpResponse, JsonResponse } from '../lib/http';
export { createFixtureHttpClient } from './fixtures/fixture-http';
export type { FixtureHttpClient } from './fixtures/fixture-http';
import type { AwaGameInput } from '../types';
import type { SyncContext } from '../services/context';
import { parseAwaGames } from '../sources/awa';

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixturePath(name: string): string {
  return path.join(FIXTURE_DIR, name);
}

export function readFixtureText(name: string): string {
  return fs.readFileSync(fixturePath(name), 'utf8');
}

export function readFixtureJson<T>(name: string): T {
  return JSON.parse(readFixtureText(name)) as T;
}

export interface TestDatabase {
  db: Client;
  dir: string;
  cleanup: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDatabase> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-proton-pulse-'));
  const db = openDb(path.join(dir, 'test.db'));
  await configureDb(db);
  await runMigrations(db);
  return {
    db,
    dir,
    cleanup: async () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function fixtureAwaGames(): AwaGameInput[] {
  return parseAwaGames(readFixtureJson<unknown>('awa-games.json'));
}

export function createFixtureMatcher(extra: { name: string; appid?: number | null }[] = []): GameMatcher {
  return createGameMatcher([
    ...fixtureAwaGames().map((game) => ({ name: game.name, appid: game.appid })),
    ...extra,
  ]);
}

export function createFixtureContext(
  db: Client,
  options: { http?: HttpClient; matcher?: GameMatcher } = {},
): SyncContext {
  const config = loadConfig({
    dataDir: '.tmp/test-data',
    disableScheduler: true,
    manualRefreshCooldownSeconds: 0,
  });
  return {
    db,
    config,
    http: options.http ?? createFixtureHttpClient(),
    matcher: options.matcher ?? createFixtureMatcher(),
    now: () => Math.floor(Date.now() / 1000),
    broadcast: () => undefined,
    log: () => undefined,
  };
}

export function staticHttpClient<T>(
  data: T,
  options: { notModified?: boolean; etag?: string | null } = {},
): HttpClient & { requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    async getJson<U>(url: string): Promise<JsonResponse<U>> {
      requests.push(url);
      return {
        status: options.notModified ? 304 : 200,
        notModified: Boolean(options.notModified),
        data: options.notModified ? null : (data as unknown as U),
        etag: options.etag ?? null,
      };
    },
    async getText(url: string, _options?: HttpRequestOptions): Promise<HttpResponse> {
      requests.push(url);
      return {
        status: 200,
        ok: true,
        notModified: false,
        body: typeof data === 'string' ? data : JSON.stringify(data),
        etag: options.etag ?? null,
        contentType: 'application/json',
      };
    },
  };
}
