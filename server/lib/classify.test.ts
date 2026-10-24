import { describe, expect, it } from 'vitest';
import {
  aggregateFlags,
  categoriesForFlags,
  classifyText,
  createEmptyFlags,
  createGameMatcher,
  extractBoldGameNames,
} from './classify';

const matcher = createGameMatcher([
  { name: 'The Elder Scrolls V: Skyrim Special Edition', appid: 489830 },
  { name: 'Euro Truck Simulator 2', appid: 227300 },
  { name: 'Control', appid: 870780 },
  { name: 'Hades', appid: 1145360 },
  { name: 'Star Citizen', appid: null },
  { name: 'HELLDIVERS™ 2', appid: 553850 },
  { name: 'Crimson Desert', appid: null },
]);

describe('game matcher', () => {
  it('matches canonical names, aliases and short games', () => {
    expect(matcher.match('Skyrim SE: Worked around poor CPU performance')[0]).toMatchObject({
      name: 'Skyrim SE',
      appid: 489830,
    });
    expect(matcher.match('Euro Truck Simulator 2 fails to start')[0]).toMatchObject({
      appid: 227300,
    });
    expect(matcher.match('Hades should no longer crash')[0]).toMatchObject({ appid: 1145360 });
    expect(matcher.match('Star Citizen is running again')[0]).toMatchObject({ name: 'Star Citizen' });
    expect(matcher.match('Crimson Desert (1.04+) is supported')[0]).toMatchObject({
      name: 'Crimson Desert',
    });
  });

  it('does not match generic single-word titles', () => {
    expect(matcher.match('Control the camera with the mouse')).toEqual([]);
  });

  it('does not match partial words', () => {
    expect(matcher.match('star citizenry')).toEqual([]);
  });

  it('extracts bold game names and skips labels', () => {
    const names = extractBoldGameNames(
      '**Call of Duty: Ghosts**: Fixed vertex explosions. **Note:** not a game. **Fixed** regression.',
      matcher,
    );
    expect(names).toEqual([{ name: 'Call of Duty: Ghosts', appid: null }]);
  });
});

describe('classification', () => {
  it('classifies game fixes as bugfix + compat', () => {
    const result = classifyText('Fixed Star Citizen crash on launch', {
      games: [{ name: 'Star Citizen', appid: null }],
    });
    expect(result.flags.bugfix).toBe(true);
    expect(result.flags.compat).toBe(true);
    expect(result.category).toBe('bugfix');
  });

  it('classifies newly playable entries', () => {
    const result = classifyText('Now playable: AsteroidsHD');
    expect(result.flags.newlyPlayable).toBe(true);
    expect(result.flags.feature).toBe(true);
    expect(result.flags.compat).toBe(true);
    expect(result.category).toBe('newly-playable');
  });

  it('detects anti-cheat changes', () => {
    const result = classifyText('Easy Anti-Cheat now works with Star Citizen');
    expect(result.flags.anticheat).toBe(true);
    expect(result.flags.compat).toBe(true);
    expect(result.category).toBe('anticheat');
  });

  it('keeps discussions as community posts instead of game fixes', () => {
    const result = classifyText('HELLDIVERS 2 crashes for me, any fix?', {
      kind: 'discussion',
      games: [{ name: 'HELLDIVERS™ 2', appid: 553850 }],
    });
    expect(result.category).toBe('discussion');
    expect(result.flags.discussion).toBe(true);
    expect(result.flags.bugfix).toBe(false);
    expect(result.flags.feature).toBe(false);
    expect(result.flags.compat).toBe(true);
  });

  it('recognizes features and performance work', () => {
    const feature = classifyText('Added HDR support for games');
    expect(feature.category).toBe('feature');
    expect(feature.flags.compat).toBe(true);

    const performance = classifyText('Improved performance and reduced stutter');
    expect(performance.flags.performance).toBe(true);
    expect(performance.flags.feature).toBe(true);
  });

  it('maps flags to display categories', () => {
    const flags = createEmptyFlags();
    flags.newlyPlayable = true;
    flags.feature = true;
    flags.bugfix = true;
    flags.compat = true;
    expect(categoriesForFlags(flags, 'release')).toEqual([
      'release',
      'newly-playable',
      'feature',
      'bugfix',
      'compat',
    ]);
  });

  it('aggregates entry flags', () => {
    const first = createEmptyFlags();
    first.feature = true;
    const second = createEmptyFlags();
    second.bugfix = true;
    const aggregated = aggregateFlags([{ flags: first }, { flags: second }]);
    expect(aggregated.feature).toBe(true);
    expect(aggregated.bugfix).toBe(true);
  });
});
