import { createClient, type Client } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dbPath: string): Client {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  return createClient({ url: dbPath === ':memory:' ? 'file::memory:' : `file:${dbPath}` });
}

export async function configureDb(db: Client): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON');
  await db.execute('PRAGMA busy_timeout = 5000');
  await db.execute('PRAGMA journal_mode = WAL');
}

export async function closeDb(db: Client): Promise<void> {
  db.close();
}
