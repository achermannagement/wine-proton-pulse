const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1]?.toLowerCase() === 'x';
      const value = Number.parseInt(isHex ? code.slice(2) : code.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(value) && value > 0 && value <= 0x10ffff) {
        try {
          return String.fromCodePoint(value);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function stripHtml(input: string): string {
  if (!input) return '';
  let value = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  value = decodeEntities(value);
  return normalizeWhitespace(value);
}

export function cleanText(input: string): string {
  return stripHtml(input);
}

export function cleanMarkdown(input: string): string {
  if (!input) return '';
  let value = input.replace(/\r\n?/g, '\n');
  value = value.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  value = value.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]*\)/g, '$1');
  value = value.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  value = value.replace(/<https?:\/\/[^>]+>/g, ' ');
  value = value.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
  value = value.replace(/\*\*([^*]+)\*\*/g, '$1');
  value = value.replace(/\*([^*\n]+)\*/g, '$1');
  value = value.replace(/~~([^~]+)~~/g, '$1');
  value = stripHtml(value);
  return normalizeWhitespace(value);
}

export function extractUrls(input: string): string[] {
  const urls: string[] = [];
  for (const match of input.matchAll(/\]\((https?:\/\/[^\s)]+)\)/gi)) {
    if (match[1]) urls.push(match[1]);
  }
  for (const match of input.matchAll(/(?<![("])\bhttps?:\/\/[^\s<>"')]+/gi)) {
    if (match[0]) urls.push(match[0]);
  }
  return [...new Set(urls.map((url) => url.replace(/[),.;]+$/, '')))];
}

export function safeHttpUrl(input: string | null | undefined, base?: string): string | null {
  if (!input) return null;
  try {
    const url = new URL(input, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const sliced = input.slice(0, Math.max(0, max - 1)).trimEnd();
  return `${sliced}…`;
}

export function normalizeName(input: string): string {
  return input
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function nameKey(input: string): string {
  return normalizeName(input);
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}

export function firstText(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
