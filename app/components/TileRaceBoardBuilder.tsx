import { useState } from 'react';
import { Box, Button, Flex, Select, Text } from '@radix-ui/themes';
import {
  BOARD_COLUMNS,
  BoardTileInputType,
  chunkIntoSnakeRows,
  IBoardTileInput,
} from '~/utils/tile-race-board';
import { Input } from '~/components/input';
import { Label } from '~/components/label';

/**
 * Click-to-build board editor that renders exactly like the public race page:
 * the ＋ tile appends, clicking a tile selects it for editing below the grid.
 * START and FINISH are fixed — the events service adds them around these tiles.
 */
interface ITileRaceBoardBuilderProps {
  tiles: IBoardTileInput[];
  onChange: (tiles: IBoardTileInput[]) => void;
}

type BuilderCell =
  | { kind: 'start' }
  | { kind: 'finish' }
  | { kind: 'add' }
  | { kind: 'tile'; tile: IBoardTileInput; index: number };

const NEW_TILE: IBoardTileInput = { type: 'TASK', name: '' };

export function TileRaceBoardBuilder({
  tiles,
  onChange,
}: ITileRaceBoardBuilderProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const cells: BuilderCell[] = [
    { kind: 'start' },
    ...tiles.map((tile, index) => ({ kind: 'tile' as const, tile, index })),
    { kind: 'add' },
    { kind: 'finish' },
  ];
  const rows = chunkIntoSnakeRows(cells, BOARD_COLUMNS);

  const updateTile = (index: number, patch: Partial<IBoardTileInput>) =>
    onChange(
      tiles.map((tile, i) => (i === index ? { ...tile, ...patch } : tile)),
    );

  const appendTile = () => {
    onChange([...tiles, NEW_TILE]);
    setSelected(tiles.length);
  };

  const insertAfter = (index: number) => {
    onChange([
      ...tiles.slice(0, index + 1),
      NEW_TILE,
      ...tiles.slice(index + 1),
    ]);
    setSelected(index + 1);
  };

  const removeTile = (index: number) => {
    onChange(tiles.filter((_, i) => i !== index));
    setSelected(null);
  };

  const moveTile = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= tiles.length) {
      return;
    }
    const next = tiles.map((tile, i) =>
      i === index ? tiles[target] : i === target ? tiles[index] : tile,
    );
    onChange(next);
    setSelected(target);
  };

  const changeType = (index: number, type: BoardTileInputType) => {
    const tile = tiles[index];
    onChange(
      tiles.map((t, i) =>
        i === index
          ? type === 'TASK'
            ? { type, name: tile.name ?? '', description: tile.description }
            : { type, amount: tile.amount ?? 1 }
          : t,
      ),
    );
  };

  const selectedTile = selected !== null ? tiles[selected] : null;

  return (
    <Box>
      <Box className="overflow-x-auto">
        <div className="grid min-w-[40rem] grid-cols-10 gap-1">
          {rows.flat().map((cell, i) => (
            <BuilderCellView
              key={i}
              cell={cell}
              selected={cell?.kind === 'tile' && cell.index === selected}
              onAppend={appendTile}
              onSelect={index => setSelected(index === selected ? null : index)}
            />
          ))}
        </div>
      </Box>

      {selectedTile && selected !== null && (
        <Box
          mt="3"
          className="border-t-2 border-t-sanguine-red bg-sanguine-red/[0.04] p-3"
        >
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Text size="3" className="text-osrs-orange">
              Tile {selected + 1} of {tiles.length}
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button
                size="2"
                variant="soft"
                type="button"
                className="cursor-pointer"
                onClick={() => moveTile(selected, -1)}
                disabled={selected === 0}
              >
                ◀ Move
              </Button>
              <Button
                size="2"
                variant="soft"
                type="button"
                className="cursor-pointer"
                onClick={() => moveTile(selected, 1)}
                disabled={selected === tiles.length - 1}
              >
                Move ▶
              </Button>
              <Button
                size="2"
                variant="soft"
                type="button"
                className="cursor-pointer"
                onClick={() => insertAfter(selected)}
              >
                Insert after
              </Button>
              <Button
                size="2"
                color="red"
                variant="soft"
                type="button"
                className="cursor-pointer"
                onClick={() => removeTile(selected)}
              >
                Delete
              </Button>
            </Flex>
          </Flex>
          <Flex mt="3" gap="4" wrap="wrap" align="end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-base" htmlFor="tileType">
                Type
              </Label>
              <Select.Root
                value={selectedTile.type}
                onValueChange={value =>
                  changeType(selected, value as BoardTileInputType)
                }
              >
                <Select.Trigger id="tileType" className="min-w-40" />
                <Select.Content>
                  <Select.Item value="TASK">Task</Select.Item>
                  <Select.Item value="GO_BACK">Go back</Select.Item>
                  <Select.Item value="GO_FORWARD">Go forward</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
            {selectedTile.type === 'TASK' ? (
              <>
                <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                  <Label className="text-base" htmlFor="tileName">
                    Task name
                  </Label>
                  <Input
                    id="tileName"
                    value={selectedTile.name ?? ''}
                    onChange={e =>
                      updateTile(selected, { name: e.target.value })
                    }
                    placeholder="50KC @ Vorkath"
                    className="text-base"
                    maxLength={100}
                  />
                </div>
                <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                  <Label className="text-base" htmlFor="tileDescription">
                    Description (optional)
                  </Label>
                  <Input
                    id="tileDescription"
                    value={selectedTile.description ?? ''}
                    onChange={e =>
                      updateTile(selected, { description: e.target.value })
                    }
                    placeholder="Any team member reaches 50 KC gained during the event"
                    className="text-base"
                    maxLength={300}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label className="text-base" htmlFor="tileAmount">
                  Tiles
                </Label>
                <Input
                  id="tileAmount"
                  type="number"
                  min={1}
                  max={20}
                  value={selectedTile.amount ?? 1}
                  onChange={e =>
                    updateTile(selected, {
                      amount: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-24 text-base"
                />
              </div>
            )}
          </Flex>
        </Box>
      )}
    </Box>
  );
}

const CELL_BASE =
  'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-sm border p-1 text-center';

function BuilderCellView({
  cell,
  selected,
  onAppend,
  onSelect,
}: {
  cell: BuilderCell | null;
  selected: boolean;
  onAppend: () => void;
  onSelect: (index: number) => void;
}) {
  if (!cell) {
    return <div aria-hidden />;
  }

  if (cell.kind === 'start' || cell.kind === 'finish') {
    return (
      <div className={`${CELL_BASE} border-gray-800 bg-gray-900`}>
        <span className="text-xs text-green-400">
          {cell.kind === 'start' ? 'START' : 'FINISH'}
        </span>
      </div>
    );
  }

  if (cell.kind === 'add') {
    return (
      <button
        type="button"
        onClick={onAppend}
        className={`${CELL_BASE} cursor-pointer border-dashed border-gray-600 bg-gray-900 hover:border-gray-400`}
        title="Add a tile"
      >
        <span className="text-lg text-gray-400">＋</span>
      </button>
    );
  }

  const { tile, index } = cell;
  const content =
    tile.type === 'GO_BACK' ? (
      <span className="text-[11px] leading-tight text-red-400">
        Go back {tile.amount}
      </span>
    ) : tile.type === 'GO_FORWARD' ? (
      <span className="text-[11px] leading-tight text-sky-400">
        Forward {tile.amount}
      </span>
    ) : tile.name?.trim() ? (
      <span className="text-[11px] leading-tight text-gray-200">
        {tile.name}
      </span>
    ) : (
      <span className="text-[11px] leading-tight text-gray-500">
        (unnamed task)
      </span>
    );

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      title={tile.description || tile.name || undefined}
      className={`${CELL_BASE} cursor-pointer ${
        selected
          ? 'border-sanguine-red bg-sanguine-red/10'
          : 'border-gray-800 bg-gray-900 hover:border-gray-500'
      }`}
    >
      <span className="absolute left-1 top-0.5 text-[10px] text-gray-600">
        {index + 1}
      </span>
      {content}
    </button>
  );
}
