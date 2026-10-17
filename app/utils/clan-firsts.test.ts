import { describe, expect, it } from 'vitest';
import {
  boardItemIds,
  firstUniquePlayers,
  rankClearsWithNetNew,
} from './clan-firsts';

const clear = (createdAt: string, participantDiscordIds: string[]) => ({
  createdAt,
  participantDiscordIds,
});

describe('rankClearsWithNetNew', () => {
  it('credits only net-new members on later teams', () => {
    const placements = rankClearsWithNetNew([
      clear('2026-10-20T10:00:00.000Z', ['foo', 'bar']),
      clear('2026-10-20T11:00:00.000Z', ['foo', 'baz']),
    ]);
    expect(placements[1]).toMatchObject({
      placement: 2,
      creditedDiscordIds: ['baz'],
      alreadyPlacedDiscordIds: ['foo'],
    });
  });

  it('skips a team with no net-new members', () => {
    const placements = rankClearsWithNetNew([
      clear('2026-10-20T10:00:00.000Z', ['foo', 'bar']),
      clear('2026-10-20T11:00:00.000Z', ['bar', 'foo']),
      clear('2026-10-20T12:00:00.000Z', ['qux', 'foo']),
    ]);
    expect(placements.map(p => p.creditedDiscordIds)).toEqual([
      ['foo', 'bar'],
      ['qux'],
    ]);
  });

  it('orders by submission time and caps at the slot count', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      clear(`2026-10-20T1${6 - i}:00:00.000Z`, [`a${i}`, `b${i}`]),
    );
    const placements = rankClearsWithNetNew(rows, 5);
    expect(placements).toHaveLength(5);
    expect(placements[0].creditedDiscordIds).toEqual(['a6', 'b6']);
  });
});

describe('firstUniquePlayers', () => {
  it('gives each member one spot, oldest drop first', () => {
    const placements = firstUniquePlayers([
      { destinationDiscordId: 'bob', createdAt: '2026-10-20T11:00:00.000Z' },
      { destinationDiscordId: 'alice', createdAt: '2026-10-20T10:00:00.000Z' },
      { destinationDiscordId: 'alice', createdAt: '2026-10-20T12:00:00.000Z' },
    ]);
    expect(placements.map(p => [p.placement, p.discordId])).toEqual([
      [1, 'alice'],
      [2, 'bob'],
    ]);
  });
});

describe('boardItemIds', () => {
  it('unions name-resolved ids with explicit ids', () => {
    expect(
      boardItemIds(
        {
          key: 'x',
          displayName: 'X',
          itemNames: ['Rondache'],
          itemIds: [5, 1],
        },
        { rondache: [1, 2] },
      ),
    ).toEqual([1, 2, 5]);
  });
});
