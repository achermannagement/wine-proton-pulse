import { createHash } from 'node:crypto';

export function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function makeId(prefix: string, key: string): string {
  return `${prefix}_${stableHash(key).slice(0, 24)}`;
}
