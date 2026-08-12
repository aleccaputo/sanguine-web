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
 * them), and each tile keeps only the fields its type submits.
 */
export const toBoardTileInputs = (
  tiles: IBoardTileLike[],
): IBoardTileInput[] =>
  tiles.flatMap((tile): IBoardTileInput[] => {
    switch (tile.type) {
      case 'TASK':
        return [
          {
            type: tile.type,
            name: tile.name ?? '',
            description: tile.description,
            imageUrl: tile.imageUrl,
            quantity: tile.quantity,
          },
        ];
      case 'GO_BACK':
      case 'GO_FORWARD':
        return [{ type: tile.type, amount: tile.amount ?? 1 }];
      default:
        return [];
    }
  });

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
export const groupTilesIntoTiers = <T,>(
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
export const chunkIntoSnakeRows = <T,>(
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
