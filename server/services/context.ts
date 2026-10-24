import type { Client } from '@libsql/client';
import type { GameMatcher } from '../lib/classify';
import type { HttpClient } from '../lib/http';
import type { AppConfig } from '../types';

export interface SyncContext {
  db: Client;
  config: AppConfig;
  http: HttpClient;
  matcher: GameMatcher;
  now: () => number;
  broadcast: (type: string, data: unknown) => void;
  log: (message: string) => void;
}
