import { describe, it, expect } from 'vitest';
import type { IPersonalBest } from '~/data/personal-bests';
import {
  buildCategoryLeaderboards,
  buildUserCategoryBests,
  comparePbTimes,
  derivePbPrecision,
  isDefunctPersonalBest,
} from './personal-bests';

// Minimal PB factory — only the fields the leaderboard logic reads. Times are passed already
// ascending, matching the effective-time-ascending order the data layer returns. Precision and
// effective time are derived the same way the data layer derives them for legacy rows, unless a
// test overrides them explicitly.
const pb = (overrides: Partial<IPersonalBest>): IPersonalBest => {
  const merged = {
    id: overrides.timeDisplay ?? 'id',
    bossName: 'Zulrah',
    scale: 1,
    raidLevel: undefined,
    categoryKey: 'zulrah|0|1',
    timeDisplay: '0:00',
    timeSeconds: 0,
    participantDiscordIds: ['a'],
    participantAltNames: [''],
    proofMessageUrl: undefined,
    createdAt: '2026-01-01',
    ...overrides,
  };
  const isPreciseTime = derivePbPrecision({
    bossName: merged.bossName,
    timeDisplay: merged.timeDisplay,
    isPreciseTime: overrides.isPreciseTime,
  });
  return {
    ...merged,
    isPreciseTime,
    effectiveTimeSeconds:
      overrides.effectiveTimeSeconds ??
      merged.timeSeconds + (isPreciseTime ? 0 : 0.4),
  };
};

describe('comparePbTimes', () => {
  it('ranks an imprecise time at its +0.4s worst case', () => {
    // Imprecise 0:55 ranks as 55.4: precise 0:55.20 beats it, precise 0:55.60 loses to it.
    const imprecise = pb({ timeDisplay: '0:55', timeSeconds: 55 });
    expect(
      comparePbTimes(
        pb({ timeDisplay: '0:55.20', timeSeconds: 55.2 }),
        imprecise,
      ),
    ).toBeLessThan(0);
    expect(
      comparePbTimes(
        pb({ timeDisplay: '0:55.60', timeSeconds: 55.6 }),
        imprecise,
      ),
    ).toBeGreaterThan(0);
  });

  it('breaks an effective-time tie in favor of the precise submission', () => {
    // A genuine 0:55.40 must sit above an imprecise 0:55 assumed to be 55.4.
    const precise = pb({ timeDisplay: '0:55.40', timeSeconds: 55.4 });
    const imprecise = pb({ timeDisplay: '0:55', timeSeconds: 55 });
    expect(comparePbTimes(precise, imprecise)).toBeLessThan(0);
    expect(comparePbTimes(imprecise, precise)).toBeGreaterThan(0);
  });

  it('ranks a delve boss deepest first', () => {
    const shallow = delve(8);
    const deep = delve(14);
    expect(comparePbTimes(deep, shallow)).toBeLessThan(0);
    expect(comparePbTimes(shallow, deep)).toBeGreaterThan(0);
  });
});

// A Doom of Mokhaiotl record: the bot stores the deepest delve as "Delve N" / N.
const delve = (level: number, overrides: Partial<IPersonalBest> = {}) =>
  pb({
    bossName: 'Doom of Mokhaiotl',
    categoryKey: 'doom of mokhaiotl|0|1',
    timeDisplay: `Delve ${level}`,
    timeSeconds: level,
    ...overrides,
  });

describe('delve bosses', () => {
  it('treats a delve level as precise, so it never shows the imprecise asterisk', () => {
    expect(delve(12).isPreciseTime).toBe(true);
    expect(delve(12).effectiveTimeSeconds).toBe(12);
  });

  it("marks Doom's legacy kill-time rows as defunct and leaves everything else alone", () => {
    expect(
      isDefunctPersonalBest({
        bossName: 'Doom of Mokhaiotl',
        timeDisplay: '7:08.40',
      }),
    ).toBe(true);
    expect(isDefunctPersonalBest(delve(38))).toBe(false);
    expect(
      isDefunctPersonalBest({ bossName: 'Zulrah', timeDisplay: '0:55' }),
    ).toBe(false);
  });

  it('builds a deepest-first leaderboard with one slot per delver', () => {
    // Pre-ranked by the data layer: deepest first, with one delver holding two depths.
    const records = [
      delve(100, { participantDiscordIds: ['a'] }),
      delve(57, { participantDiscordIds: ['b'] }),
      delve(38, { participantDiscordIds: ['a'] }),
      delve(12, { participantDiscordIds: ['c'] }),
    ];

    const [category] = buildCategoryLeaderboards(records, 5);

    expect(category.entries.map(e => e.timeDisplay)).toEqual([
      'Delve 100',
      'Delve 57',
      'Delve 12',
    ]);
  });

  it('ranks a member by how many delvers went deeper', () => {
    const field = [
      delve(100, { participantDiscordIds: ['a'] }),
      delve(57, { participantDiscordIds: ['me'] }),
      delve(38, { participantDiscordIds: ['me'] }),
      delve(12, { participantDiscordIds: ['c'] }),
    ];

    const [best] = buildUserCategoryBests('me', field);

    expect(best.best.timeDisplay).toBe('Delve 57');
    expect(best.rank).toBe(2);
    expect(best.totalEntries).toBe(3);
  });
});

describe('buildCategoryLeaderboards', () => {
  it("keeps only each team's fastest time, then fills with the next unique team", () => {
    // The same solo player holds the top two times.
    const records = [
      pb({
        timeDisplay: '0:43',
        timeSeconds: 43,
        participantDiscordIds: ['a'],
      }),
      pb({
        timeDisplay: '0:48',
        timeSeconds: 48,
        participantDiscordIds: ['a'],
      }),
      pb({
        timeDisplay: '0:50',
        timeSeconds: 50,
        participantDiscordIds: ['b'],
      }),
    ];

    const [category] = buildCategoryLeaderboards(records, 5);

    // a's slower 0:48 is dropped; b takes the second slot.
    expect(category.entries.map(e => e.timeDisplay)).toEqual(['0:43', '0:50']);
  });

  it('treats a team as the same competitor regardless of roster order or alts', () => {
    const records = [
      pb({
        timeDisplay: '20:00',
        timeSeconds: 1200,
        scale: 2,
        participantDiscordIds: ['a', 'b'],
        participantAltNames: ['', ''],
      }),
      pb({
        timeDisplay: '21:00',
        timeSeconds: 1260,
        scale: 2,
        participantDiscordIds: ['b', 'a'],
        participantAltNames: ['a alt', ''],
      }),
      pb({
        timeDisplay: '22:00',
        timeSeconds: 1320,
        scale: 2,
        participantDiscordIds: ['a', 'c'],
        participantAltNames: ['', ''],
      }),
    ];

    const [category] = buildCategoryLeaderboards(records, 5);

    // a+b (in either order, on any account) collapses to its fastest; a+c is a distinct team.
    expect(category.entries.map(e => e.timeDisplay)).toEqual([
      '20:00',
      '22:00',
    ]);
  });

  it('caps the board at the limit after de-duping', () => {
    const records = [
      pb({
        timeDisplay: '0:43',
        timeSeconds: 43,
        participantDiscordIds: ['a'],
      }),
      pb({
        timeDisplay: '0:50',
        timeSeconds: 50,
        participantDiscordIds: ['b'],
      }),
      pb({
        timeDisplay: '0:55',
        timeSeconds: 55,
        participantDiscordIds: ['c'],
      }),
    ];

    const [category] = buildCategoryLeaderboards(records, 2);

    expect(category.entries.map(e => e.timeDisplay)).toEqual(['0:43', '0:50']);
  });

  it('groups by category and sorts boss alphabetical', () => {
    const records = [
      pb({
        categoryKey: 'zulrah|0|1',
        bossName: 'Zulrah',
        timeDisplay: '0:43',
        timeSeconds: 43,
        participantDiscordIds: ['a'],
      }),
      pb({
        categoryKey: 'abyssal sire|0|1',
        bossName: 'Abyssal Sire',
        timeDisplay: '1:00',
        timeSeconds: 60,
        participantDiscordIds: ['a'],
      }),
    ];

    const result = buildCategoryLeaderboards(records, 5);

    expect(result.map(c => c.bossName)).toEqual(['Abyssal Sire', 'Zulrah']);
  });
});

describe('buildUserCategoryBests', () => {
  it('ranks the member against unique teams, not raw submissions', () => {
    // 'a' holds three of the four times; 'me' is 2nd-fastest team overall.
    const field = [
      pb({
        timeDisplay: '0:40',
        timeSeconds: 40,
        participantDiscordIds: ['a'],
      }),
      pb({
        timeDisplay: '0:45',
        timeSeconds: 45,
        participantDiscordIds: ['me'],
      }),
      pb({
        timeDisplay: '0:48',
        timeSeconds: 48,
        participantDiscordIds: ['a'],
      }),
      pb({
        timeDisplay: '0:55',
        timeSeconds: 55,
        participantDiscordIds: ['a'],
      }),
    ];

    const [best] = buildUserCategoryBests('me', field);

    // Raw-submission ranking would call this "#2 of 4"; against unique teams it's "#2 of 2".
    expect(best.rank).toBe(2);
    expect(best.totalEntries).toBe(2);
  });

  it("uses the member's own fastest submission as their best", () => {
    const field = [
      pb({
        timeDisplay: '0:45',
        timeSeconds: 45,
        participantDiscordIds: ['me'],
      }),
      pb({
        timeDisplay: '0:50',
        timeSeconds: 50,
        participantDiscordIds: ['me'],
      }),
    ];

    const [best] = buildUserCategoryBests('me', field);

    expect(best.best.timeDisplay).toBe('0:45');
    expect(best.rank).toBe(1);
    expect(best.totalEntries).toBe(1);
  });

  it('ranks a precise time ahead of an imprecise one inside its rounding window', () => {
    // Effective order: precise 0:55.20 (55.2) < imprecise 0:55 for 'me' (ranked 55.4).
    const field = [
      pb({
        timeDisplay: '0:55.20',
        timeSeconds: 55.2,
        participantDiscordIds: ['a'],
      }),
      pb({
        timeDisplay: '0:55',
        timeSeconds: 55,
        participantDiscordIds: ['me'],
      }),
    ];

    const [best] = buildUserCategoryBests('me', field);

    expect(best.rank).toBe(2);
    expect(best.totalEntries).toBe(2);
  });

  it('counts a recurring teammate group as one competitor when ranking', () => {
    const field = [
      pb({
        timeDisplay: '20:00',
        timeSeconds: 1200,
        scale: 2,
        participantDiscordIds: ['x', 'y'],
        participantAltNames: ['', ''],
      }),
      pb({
        timeDisplay: '21:00',
        timeSeconds: 1260,
        scale: 2,
        participantDiscordIds: ['y', 'x'],
        participantAltNames: ['', ''],
      }),
      pb({
        timeDisplay: '22:00',
        timeSeconds: 1320,
        scale: 2,
        participantDiscordIds: ['x', 'me'],
        participantAltNames: ['', ''],
      }),
    ];

    const [best] = buildUserCategoryBests('me', field);

    // x+y (either order) is one team ahead of x+me, so 'me' is 2nd of 2 teams.
    expect(best.rank).toBe(2);
    expect(best.totalEntries).toBe(2);
  });
});
