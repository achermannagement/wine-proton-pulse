import { describe, expect, it } from 'vitest';
import {
  cleanMarkdown,
  cleanText,
  decodeEntities,
  extractUrls,
  normalizeName,
  safeHttpUrl,
  stripHtml,
  truncate,
} from './text';
import { dayStartSeconds, parseDateToEpoch } from './time';

describe('text helpers', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Hello &amp; &#39;world&#39; &#x1F600;')).toBe("Hello & 'world' 😀");
  });

  it('strips HTML and collapses whitespace', () => {
    expect(stripHtml('<p>Hello <b>world</b><br>next</p>')).toBe('Hello world next');
    expect(cleanText('A &amp; B')).toBe('A & B');
  });

  it('cleans markdown links, emphasis and inline code', () => {
    expect(
      cleanMarkdown(
        '**Call of Duty: Ghosts**: Fixed [issue](https://example.com/1) with `shader` compilation.',
      ),
    ).toBe('Call of Duty: Ghosts: Fixed issue with shader compilation.');
  });

  it('extracts unique HTTP links', () => {
    const urls = extractUrls(
      'See [issue](https://github.com/a/b/issues/1) and https://example.com/x). Also https://example.com/x',
    );
    expect(urls).toContain('https://github.com/a/b/issues/1');
    expect(urls).toContain('https://example.com/x');
    expect(urls.filter((url) => url === 'https://example.com/x')).toHaveLength(1);
  });

  it('rejects unsafe URL schemes and resolves relative URLs', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('/app/1', 'https://store.steampowered.com/api')).toBe(
      'https://store.steampowered.com/app/1',
    );
    expect(safeHttpUrl('ftp://example.com/file')).toBeNull();
  });

  it('normalizes game names for matching', () => {
    expect(normalizeName("Tom Clancy's Rainbow Six® Siege")).toBe(
      'tom clancy s rainbow six siege',
    );
    expect(normalizeName('ELDEN RING')).toBe('elden ring');
    expect(normalizeName('A & B')).toBe('a and b');
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
    expect(truncate('short', 20)).toBe('short');
  });

  it('parses dates and day buckets', () => {
    const iso = '2026-10-23T20:00:00Z';
    expect(parseDateToEpoch(iso)).toBe(Math.floor(Date.parse(iso) / 1000));
    expect(parseDateToEpoch(1_700_000_000_000)).toBe(1_700_000_000);
    expect(parseDateToEpoch('not a date')).toBeNull();
    expect(dayStartSeconds(1_700_000_000)).toBe(Math.floor(1_700_000_000 / 86_400) * 86_400);
  });
});
