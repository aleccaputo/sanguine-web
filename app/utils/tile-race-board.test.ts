import { describe, expect, it } from 'vitest';
import {
  chunkIntoSnakeRows,
  groupTilesIntoTiers,
  IBoardTileInput,
  IBoardTileLike,
  isTierBoardValid,
  toBoardTileInputs,
  toTierInputs,
} from './tile-race-board';

describe('chunkIntoSnakeRows', () => {
  it('reverses every other row so the path snakes', () => {
    const rows = chunkIntoSnakeRows([1, 2, 3, 4, 5, 6], 3);
    expect(rows).toEqual([
      [1, 2, 3],
      [6, 5, 4],
    ]);
  });

  it('pads short rows on the side the path travels from', () => {
    // row 1 travels right-to-left, so its tiles hug the right edge
    expect(chunkIntoSnakeRows([1, 2, 3, 4], 3)).toEqual([
      [1, 2, 3],
      [null, null, 4],
    ]);
    // row 2 travels left-to-right again, so padding falls at the end
    expect(chunkIntoSnakeRows([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [6, 5, 4],
      [7, null, null],
    ]);
  });

  it('handles an empty list', () => {
    expect(chunkIntoSnakeRows([], 3)).toEqual([]);
  });
});

describe('toBoardTileInputs', () => {
  it('drops START/FINISH and keeps only each type’s own fields', () => {
    const served: IBoardTileLike[] = [
      { type: 'START', name: 'Start' },
      {
        type: 'TASK',
        name: 'Punch Vorkath to death',
        imageUrl: 'https://oldschool.runescape.wiki/images/Vorkath.png',
        // a stray amount from a hand-edited payload must not survive on a TASK
        amount: 3,
      },
      { type: 'GO_BACK', amount: 2, name: 'ignored' },
      { type: 'FINISH', name: 'Finish' },
    ];
    expect(toBoardTileInputs(served)).toEqual([
      {
        type: 'TASK',
        name: 'Punch Vorkath to death',
        description: undefined,
        imageUrl: 'https://oldschool.runescape.wiki/images/Vorkath.png',
      },
      { type: 'GO_BACK', amount: 2 },
    ]);
  });
});

const servedTieredBoard: IBoardTileLike[] = [
  { type: 'START', name: 'Start' },
  { type: 'TASK', name: 'A' },
  { type: 'TASK', name: 'B' },
  { type: 'TASK', name: 'C' },
  { type: 'TASK', name: 'D', quantity: 10 },
  { type: 'TASK', name: 'E' },
  { type: 'FINISH', name: 'Finish' },
];

describe('toTierInputs', () => {
  it('splits a served tiered board back into its tiers', () => {
    const tiers = toTierInputs(servedTieredBoard, [2, 3]);
    expect(tiers).toHaveLength(2);
    expect(tiers[0].map(tile => tile.name)).toEqual(['A', 'B']);
    expect(tiers[1].map(tile => tile.name)).toEqual(['C', 'D', 'E']);
    expect(tiers[1][1].quantity).toBe(10);
  });
});

describe('groupTilesIntoTiers', () => {
  it('groups the served tiles per tier without START and FINISH', () => {
    const tiers = groupTilesIntoTiers(servedTieredBoard, [2, 3]);
    expect(tiers.map(tier => tier.length)).toEqual([2, 3]);
    expect(tiers[0][0]).toMatchObject({ name: 'A' });
    expect(tiers[1][2]).toMatchObject({ name: 'E' });
  });
});

describe('isTierBoardValid', () => {
  const namedTask = (name: string): IBoardTileInput => ({
    type: 'TASK',
    name,
  });

  it('accepts tiers of named tasks and rejects structural problems', () => {
    expect(isTierBoardValid([[namedTask('A')], [namedTask('B')]])).toBe(true);
    expect(isTierBoardValid([])).toBe(false);
    expect(isTierBoardValid([[namedTask('A')], []])).toBe(false);
    expect(isTierBoardValid([[namedTask('A'), { type: 'TASK', name: ' ' }]])).toBe(false);
    expect(isTierBoardValid([[{ type: 'GO_BACK', amount: 1 }]])).toBe(false);
    expect(
      isTierBoardValid([
        Array.from({ length: 21 }, (_, i) => namedTask(`T${i}`)),
      ]),
    ).toBe(false);
  });
});
