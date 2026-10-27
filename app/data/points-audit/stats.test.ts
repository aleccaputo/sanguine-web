import { describe, expect, it } from 'vitest';
import type { OSRSItem } from '~/utils/osrs-item';
import { computeClanTotals, computeClanTotalsFromCounts } from './stats';

const item = (id: number, price: number): OSRSItem =>
  ({ id, name: `item ${id}`, price }) as OSRSItem;

const drop = (itemId: number | null, pointsGiven: number) => ({
  id: `${itemId}-${pointsGiven}-${Math.random()}`,
  itemId,
  bossName: null,
  pointsGiven,
  createdAt: '2026-01-01T00:00:00.000Z',
  destinationDiscordId: '1',
  osrsName: null,
});

describe('computeClanTotalsFromCounts', () => {
  const itemMap = new Map<number, OSRSItem>([
    [1, item(1, 1_000)],
    [2, item(2, 250)],
  ]);

  it('matches computeClanTotals over the equivalent drop rows', () => {
    const drops = [drop(1, 5), drop(1, 5), drop(2, 2), drop(null, 1), drop(3, 4)];
    const counts = [
      { itemId: 1, count: 2, points: 10 },
      { itemId: 2, count: 1, points: 2 },
      { itemId: null, count: 1, points: 1 },
      { itemId: 3, count: 1, points: 4 },
    ];
    expect(computeClanTotalsFromCounts(counts, itemMap)).toEqual(
      computeClanTotals(drops, itemMap),
    );
  });

  it('multiplies the item price by the count and ignores unpriced items', () => {
    expect(
      computeClanTotalsFromCounts(
        [
          { itemId: 1, count: 3, points: 0 },
          { itemId: 99, count: 7, points: 0 },
        ],
        itemMap,
      ),
    ).toEqual({ totalDrops: 10, totalGP: 3_000, totalPoints: 0 });
  });

  it('is zero for no drops', () => {
    expect(computeClanTotalsFromCounts([], itemMap)).toEqual({
      totalDrops: 0,
      totalGP: 0,
      totalPoints: 0,
    });
  });
});
