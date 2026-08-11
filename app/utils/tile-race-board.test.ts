import { describe, expect, it } from 'vitest';
import {
  chunkIntoSnakeRows,
  IBoardTileLike,
  toBoardTileInputs,
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
