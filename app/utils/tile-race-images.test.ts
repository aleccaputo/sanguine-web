import { describe, expect, it } from 'vitest';
import { getTileImageUrl } from './tile-race-images';

const WIKI = 'https://oldschool.runescape.wiki/images';

describe('getTileImageUrl', () => {
  it('matches a boss name anywhere in freeform task text', () => {
    expect(getTileImageUrl('Punch Vorkath to death')).toBe(
      `${WIKI}/Vorkath.png`,
    );
    expect(getTileImageUrl('60KC @ Barrows')).toBe(
      `${WIKI}/Ahrim_the_Blighted.png`,
    );
  });

  it('matches clan slang via word-boundary aliases', () => {
    expect(getTileImageUrl('3KC @ CG')).toBe(`${WIKI}/Corrupted_Hunllef.png`);
    // but not as a fragment inside another word
    expect(getTileImageUrl('McGregor challenge')).toBeNull();
  });

  it('prefers the specific rule over the generic word it contains', () => {
    expect(getTileImageUrl("Phosani's Nightmare unique")).toBe(
      `${WIKI}/The_Nightmare.png`,
    );
    expect(getTileImageUrl('Corrupted Gauntlet speedrun')).toBe(
      `${WIKI}/Corrupted_Hunllef.png`,
    );
    expect(getTileImageUrl('Gauntlet speedrun')).toBe(
      `${WIKI}/The_Gauntlet.png`,
    );
  });

  it('falls back to the description only when the name has no match', () => {
    expect(getTileImageUrl('Any GWD unique', 'Any God Wars Dungeon boss')).toBe(
      `${WIKI}/General_Graardor.png`,
    );
    // name match wins even when the description names a different boss
    expect(
      getTileImageUrl('100KC @ Zulrah', 'harder than Vorkath, honest'),
    ).toBe(`${WIKI}/Zulrah_(serpentine).png`);
  });

  it('returns null rather than guessing for unmatched tasks', () => {
    expect(getTileImageUrl('Reach 6hr log')).toBeNull();
    expect(getTileImageUrl(undefined, undefined)).toBeNull();
  });
});
