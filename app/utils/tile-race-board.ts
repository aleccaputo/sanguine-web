// Shared board helpers for the public tile race page and the admin board builder.

export type BoardTileInputType = 'TASK' | 'GO_BACK' | 'GO_FORWARD';

/** A tile as the events API accepts it at race creation (before START/FINISH are added). */
export interface IBoardTileInput {
  type: BoardTileInputType;
  name?: string;
  description?: string;
  /** TASK tiles: admin-picked OSRS wiki artwork (wiki-hosted URLs only) */
  imageUrl?: string;
  /** TASK tiles: approved submissions required to complete the tile (1 = ordinary) */
  quantity?: number;
  amount?: number;
  /**
   * The index this tile has on the served board it was loaded from; absent on
   * tiles added in the editor. On a running race the events API follows it to
   * re-point every team's moves at the tile's new index.
   */
  sourceIndex?: number;
}

export const BOARD_COLUMNS = 10;

/** A board tile as any race payload serves it (superset of the input shape). */
export interface IBoardTileLike {
  type: 'START' | 'FINISH' | BoardTileInputType;
  name?: string;
  description?: string;
  imageUrl?: string;
  quantity?: number;
  amount?: number;
}

/**
 * A served board back into builder inputs: START/FINISH drop (the API re-adds
 * them), and each tile keeps only the fields its type submits, plus its board
 * index as sourceIndex (the served list is the full board, START at 0).
 */
export const toBoardTileInputs = (tiles: IBoardTileLike[]): IBoardTileInput[] =>
  tiles.flatMap((tile, sourceIndex): IBoardTileInput[] => {
    switch (tile.type) {
      case 'TASK':
        return [
          {
            type: tile.type,
            name: tile.name ?? '',
            description: tile.description,
            imageUrl: tile.imageUrl,
            quantity: tile.quantity,
            sourceIndex,
          },
        ];
      case 'GO_BACK':
      case 'GO_FORWARD':
        return [{ type: tile.type, amount: tile.amount ?? 1, sourceIndex }];
      default:
        return [];
    }
  });

/**
 * Board indexes some team is standing on or has cleared. The events API refuses
 * a live edit that removes one of these (edit it in place instead), so the
 * builder locks their delete buttons up front.
 */
export const landedTileIndexes = (
  standings: { tileIndex: number; history?: { tileIndex: number }[] }[],
): Set<number> =>
  new Set(
    standings.flatMap(standing => [
      standing.tileIndex,
      ...(standing.history ?? []).map(entry => entry.tileIndex),
    ]),
  );

/**
 * A served tiered board back into builder inputs: START/FINISH drop and the
 * flat tile list splits back into its tiers.
 */
export const toTierInputs = (
  tiles: IBoardTileLike[],
  tierSizes: number[],
): IBoardTileInput[][] => {
  const tasks = toBoardTileInputs(tiles);
  return tierSizes.map((size, tier) => {
    const start = tierSizes
      .slice(0, tier)
      .reduce((sum, tierSize) => sum + tierSize, 0);
    return tasks.slice(start, start + size);
  });
};

/**
 * A served tiered board's tiles grouped per tier (START and FINISH dropped) —
 * how the public page renders a tiered board, one row of tiles per tier.
 */
export const groupTilesIntoTiers = <T>(
  tiles: T[],
  tierSizes: number[],
): T[][] => {
  const tasks = tiles.slice(1, -1);
  return tierSizes.map((size, tier) => {
    const start = tierSizes
      .slice(0, tier)
      .reduce((sum, tierSize) => sum + tierSize, 0);
    return tasks.slice(start, start + size);
  });
};

/**
 * How many tiers the public page may show: every tier some team has reached,
 * never fewer than 1 (finished teams have seen the whole board). Unreached
 * tiers stay face-down until a team lands on them.
 */
export const countRevealedTiers = (
  standings: { tier?: number | null; isFinished: boolean }[],
  tierCount: number,
): number =>
  Math.max(
    1,
    ...standings.map(standing =>
      standing.isFinished ? tierCount : Math.min(standing.tier ?? 1, tierCount),
    ),
  );

/**
 * Strips task content (name/description/artwork/quantity) from every tile past
 * the revealed tiers, so unrevealed tasks never reach the browser — hiding them
 * only in the UI would leak the whole board through the network tab. Structure
 * (index/type/tier) survives, as does the FINISH tile.
 */
export const redactTilesBeyondTier = <T extends IBoardTileLike>(
  tiles: T[],
  tierSizes: number[],
  revealedTiers: number,
): T[] => {
  // +1 skips START; tiles within the revealed tiers keep their content.
  const firstHiddenIndex =
    1 + tierSizes.slice(0, revealedTiers).reduce((sum, size) => sum + size, 0);
  return tiles.map((tile, index) =>
    index >= firstHiddenIndex && tile.type !== 'FINISH'
      ? {
          ...tile,
          name: undefined,
          description: undefined,
          imageUrl: undefined,
          quantity: undefined,
          amount: undefined,
        }
      : tile,
  );
};

/** Client-side mirror of the API's tiered board rules, gating the submit button. */
export const isTierBoardValid = (tiers: IBoardTileInput[][]): boolean =>
  tiers.length > 0 &&
  tiers.every(
    tier =>
      tier.length > 0 &&
      tier.length <= 20 &&
      tier.every(tile => tile.type === 'TASK' && (tile.name ?? '').trim()),
  );

/**
 * Chutes-and-ladders reading order: rows alternate direction, and short rows keep
 * their items on the side the path travels from (nulls fill the dead cells).
 */
export const chunkIntoSnakeRows = <T>(
  items: T[],
  columns: number = BOARD_COLUMNS,
): (T | null)[][] =>
  Array.from({ length: Math.ceil(items.length / columns) }, (_, row) => {
    const slice = items.slice(row * columns, (row + 1) * columns);
    const padded: (T | null)[] = [
      ...slice,
      ...Array<null>(columns - slice.length).fill(null),
    ];
    return row % 2 === 1 ? [...padded].reverse() : padded;
  });
