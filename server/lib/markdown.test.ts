import { describe, expect, it } from 'vitest';
import { parseReleaseMarkdown, parseWineRelease } from './markdown';
import { createFixtureMatcher, readFixtureJson } from '../test/helpers';

interface GithubReleaseFixture {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
}

function githubRelease(file: string, tag: string): GithubReleaseFixture {
  const releases = readFixtureJson<GithubReleaseFixture[]>(file);
  const release = releases.find((candidate) => candidate.tag_name === tag);
  if (!release) throw new Error(`Missing fixture ${file}:${tag}`);
  return release;
}

const matcher = createFixtureMatcher();

describe('GitHub release note parser', () => {
  it('parses Proton newly playable games, nested fixes and game mentions', () => {
    const release = githubRelease('github-proton.json', 'proton-11.0-2');
    const parsed = parseReleaseMarkdown(release.body ?? '', {
      matcher,
      releaseUrl: release.html_url,
    });

    expect(parsed.entries.length).toBeGreaterThan(40);
    expect(parsed.flags.newlyPlayable).toBe(true);
    expect(parsed.flags.feature).toBe(true);
    expect(parsed.flags.bugfix).toBe(true);
    expect(parsed.flags.compat).toBe(true);
    expect(parsed.summary).toContain('Newly playable');

    const asteroids = parsed.entries.find((entry) => entry.text === 'AsteroidsHD');
    expect(asteroids).toMatchObject({
      section: 'Now playable',
      category: 'newly-playable',
    });
    expect(asteroids?.flags.newlyPlayable).toBe(true);
    expect(asteroids?.games[0]).toMatchObject({ name: 'AsteroidsHD' });

    const terraria = parsed.entries.find((entry) =>
      entry.text.startsWith('Terraria should no longer perform worse'),
    );
    expect(terraria?.category).toBe('bugfix');
    expect(terraria?.games).toContainEqual({ name: 'Terraria', appid: 105600 });

    const cnc = parsed.entries.find((entry) =>
      entry.text.startsWith('Command & Conquer: Generals'),
    );
    expect(cnc?.category).toBe('bugfix');
    expect(cnc?.flags.bugfix).toBe(true);
    expect(cnc?.flags.compat).toBe(true);

    const worms = parsed.entries.find((entry) => entry.text.startsWith('Fixed Worms Armageddon'));
    expect(worms?.category).toBe('bugfix');
  });

  it('parses GE-Proton sections, anti-cheat fixes and protonfixes', () => {
    const release = githubRelease('github-ge.json', 'GE-Proton11-11');
    const parsed = parseReleaseMarkdown(release.body ?? '', {
      matcher,
      releaseUrl: release.html_url,
    });

    expect(parsed.flags.anticheat).toBe(true);
    expect(parsed.flags.bugfix).toBe(true);
    expect(parsed.flags.compat).toBe(true);

    const starCitizen = parsed.entries.find((entry) =>
      entry.text.includes('Easy Anti-Cheat kicking Star Citizen'),
    );
    expect(starCitizen?.category).toBe('anticheat');
    expect(starCitizen?.flags.anticheat).toBe(true);
    expect(starCitizen?.games.some((game) => game.name === 'Star Citizen')).toBe(true);

    const video = parsed.entries.find((entry) =>
      entry.text.startsWith('Fixed games freezing when a video is skipped'),
    );
    expect(video?.section).toBe('Video Playback');
    expect(video?.category).toBe('bugfix');

    const protonfix = parsed.entries.find((entry) =>
      entry.text.startsWith('Star Citizen: install .NET 4.8'),
    );
    expect(protonfix?.section).toBe('Protonfixes');
    expect(protonfix?.category).toBe('bugfix');
  });

  it('distinguishes DXVK features from fixes in a mixed section', () => {
    const release = githubRelease('github-dxvk.json', 'v3.1.1');
    const parsed = parseReleaseMarkdown(release.body ?? '', {
      matcher,
      releaseUrl: release.html_url,
    });

    const implemented = parsed.entries.find((entry) =>
      entry.text.startsWith('Implemented DXGI_SCALING_NONE'),
    );
    expect(implemented?.section).toBe('Bug fixes and Improvements');
    expect(implemented?.category).toBe('feature');

    const ghosts = parsed.entries.find((entry) =>
      entry.text.startsWith('Call of Duty: Ghosts: Fixed vertex explosions'),
    );
    expect(ghosts?.category).toBe('bugfix');
    expect(ghosts?.games).toContainEqual({ name: 'Call of Duty: Ghosts', appid: null });

    const skyrim = parsed.entries.find((entry) =>
      entry.text.startsWith('Skyrim SE: Worked around poor CPU performance'),
    );
    expect(skyrim?.category).toBe('bugfix');
    expect(skyrim?.flags.performance).toBe(true);
    expect(skyrim?.games).toContainEqual({
      name: 'Skyrim SE',
      appid: 489830,
    });
  });

  it('parses VKD3D feature and fix sections', () => {
    const release = githubRelease('github-vkd3d.json', 'v3.0.1');
    const parsed = parseReleaseMarkdown(release.body ?? '', {
      matcher,
      releaseUrl: release.html_url,
    });

    const viewInstancing = parsed.entries.find((entry) =>
      entry.text.startsWith('D3D12 view instancing is now experimentally supported'),
    );
    expect(viewInstancing?.section).toBe('Features');
    expect(viewInstancing?.category).toBe('feature');
    expect(viewInstancing?.games).toContainEqual({ name: 'Crimson Desert', appid: null });

    const primitiveId = parsed.entries.find((entry) =>
      entry.text.startsWith('Allow SV_PrimitiveID'),
    );
    expect(primitiveId?.section).toBe('Fixes');
    expect(primitiveId?.category).toBe('bugfix');
  });

  it('parses CRLF bodies and ignores fenced code blocks', () => {
    const body = [
      '## Features',
      '- Added support for a new controller',
      '',
      '```',
      '- This is code, not a changelog entry',
      '```',
      '',
      '## Fixes',
      '- Fixed a crash in a game',
    ].join('\r\n');
    const parsed = parseReleaseMarkdown(body, {
      matcher,
      releaseUrl: 'https://example.com/release',
    });
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]?.text).toBe('Added support for a new controller');
    expect(parsed.entries[1]?.text).toBe('Fixed a crash in a game');
  });

  it('creates a fallback entry for a short body with no bullets', () => {
    const parsed = parseReleaseMarkdown('This build fixes a crash in a game.', {
      matcher,
      releaseUrl: 'https://example.com/release',
    });
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.category).toBe('bugfix');
  });

  it('returns no entries for an empty body', () => {
    expect(
      parseReleaseMarkdown('', { matcher, releaseUrl: 'https://example.com/release' }).entries,
    ).toEqual([]);
  });
});

describe('Wine release note parser', () => {
  const releases = readFixtureJson<
    { tag_name: string; description: string; _links?: { self?: string } }[]
  >('wine-releases.json');
  const release = releases.find((candidate) => candidate.tag_name === 'wine-11.20');
  if (!release) throw new Error('Missing Wine 11.20 fixture');

  const parsed = parseWineRelease(release.description, {
    matcher,
    releaseUrl: release._links?.self ?? 'https://gitlab.winehq.org/wine/wine/-/releases/wine-11.20',
  });

  it('parses what’s new as features', () => {
    const features = parsed.entries.filter((entry) => entry.section === 'What’s new');
    expect(features.length).toBeGreaterThanOrEqual(3);
    expect(features.every((entry) => entry.flags.feature)).toBe(true);
    expect(parsed.flags.feature).toBe(true);
  });

  it('parses the bug-fix list with Bugzilla links', () => {
    const bugs = parsed.entries.filter((entry) => entry.section?.startsWith('Bugs fixed'));
    expect(bugs.length).toBeGreaterThan(20);
    expect(bugs.every((entry) => entry.category === 'bugfix')).toBe(true);
    const purePinball = bugs.find((entry) => entry.text.includes('Pure Pinball'));
    expect(purePinball?.externalUrl).toMatch(/bugs\.winehq\.org\/show_bug\.cgi\?id=\d+/);
    expect(purePinball?.flags.compat).toBe(true);
  });

  it('ignores the giant Changes since diff', () => {
    expect(parsed.entries.some((entry) => entry.text.includes('Aleksei Arsenev'))).toBe(false);
    expect(parsed.entries.some((entry) => entry.text.includes('Changes since'))).toBe(false);
  });
});
