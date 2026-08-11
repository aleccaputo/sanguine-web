// Shared board helpers for the public tile race page and the admin board builder.

export type BoardTileInputType = 'TASK' | 'GO_BACK' | 'GO_FORWARD';

/** A tile as the events API accepts it at race creation (before START/FINISH are added). */
export interface IBoardTileInput {
  type: BoardTileInputType;
  name?: string;
  description?: string;
  /** TASK tiles: admin-picked OSRS wiki artwork (wiki-hosted URLs only) */
  imageUrl?: string;
  amount?: number;
}

export const BOARD_COLUMNS = 10;

/** A board tile as any race payload serves it (superset of the input shape). */
export interface IBoardTileLike {
  type: 'START' | 'FINISH' | BoardTileInputType;
  name?: string;
  description?: string;
  imageUrl?: string;
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
