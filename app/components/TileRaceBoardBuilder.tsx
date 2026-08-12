import { useState } from 'react';
import { Box, Flex, Select, Text } from '@radix-ui/themes';
import { Button } from '~/components/button';
import {
  BOARD_COLUMNS,
  BoardTileInputType,
  chunkIntoSnakeRows,
  IBoardTileInput,
} from '~/utils/tile-race-board';
import { Input } from '~/components/input';
import { Label } from '~/components/label';
import { getTileImageUrl } from '~/utils/tile-race-images';
import { TileArt } from '~/components/TileArt';
import { TileImagePicker } from '~/components/TileImagePicker';

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
            <Text size="4" className="text-osrs-orange">
              Tile {selected + 1} of {tiles.length}
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button
                type="button"
                onClick={() => moveTile(selected, -1)}
                disabled={selected === 0}
              >
                ◀ Move
              </Button>
              <Button
                type="button"
                onClick={() => moveTile(selected, 1)}
                disabled={selected === tiles.length - 1}
              >
                Move ▶
              </Button>
              <Button type="button" onClick={() => insertAfter(selected)}>
                Insert after
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => removeTile(selected)}
              >
                Delete
              </Button>
            </Flex>
          </Flex>
          <Flex mt="3" gap="4" wrap="wrap" align="end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-lg" htmlFor="tileType">
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
              <TaskTileFields
                tile={selectedTile}
                onPatch={patch => updateTile(selected, patch)}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label className="text-lg" htmlFor="tileAmount">
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
                  className="w-24 text-lg"
                />
              </div>
            )}
          </Flex>
        </Box>
      )}
    </Box>
  );
}

// The shared TASK editor fields — same inputs whether the tile lives on a
// classic board or inside a tier.
function TaskTileFields({
  tile,
  onPatch,
}: {
  tile: IBoardTileInput;
  onPatch: (patch: Partial<IBoardTileInput>) => void;
}) {
  return (
    <>
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label className="text-lg" htmlFor="tileName">
          Task name
        </Label>
        <Input
          id="tileName"
          value={tile.name ?? ''}
          onChange={e => onPatch({ name: e.target.value })}
          placeholder="50KC @ Vorkath"
          className="text-lg"
          maxLength={100}
        />
      </div>
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label className="text-lg" htmlFor="tileDescription">
          Description (optional)
        </Label>
        <Input
          id="tileDescription"
          value={tile.description ?? ''}
          onChange={e => onPatch({ description: e.target.value })}
          placeholder="Any team member reaches 50 KC gained during the event"
          className="text-lg"
          maxLength={300}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-lg" htmlFor="tileQuantity">
          Drops needed
        </Label>
        <Input
          id="tileQuantity"
          type="number"
          min={1}
          max={1000}
          value={tile.quantity ?? 1}
          onChange={e => {
            const quantity = Math.max(1, Number(e.target.value) || 1);
            // 1 is an ordinary tile — keep the payload clean
            onPatch({ quantity: quantity > 1 ? quantity : undefined });
          }}
          className="w-24 text-lg"
        />
      </div>
      <div className="flex min-w-64 flex-col gap-1.5">
        <Label className="text-lg" htmlFor="tileImage">
          Image (optional)
        </Label>
        <TileImagePicker
          id="tileImage"
          value={tile.imageUrl}
          onChange={imageUrl => onPatch({ imageUrl })}
        />
      </div>
    </>
  );
}

/**
 * Tier-by-tier variant of the board builder: one row of tiles per tier, TASK
 * tiles only. Each tier's die matches its tile count, so the row header shows
 * the die a team will roll when it reaches that tier.
 */
interface ITileRaceTierBoardBuilderProps {
  tiers: IBoardTileInput[][];
  onChange: (tiers: IBoardTileInput[][]) => void;
}

const MAX_TIER_SIZE = 20;

export function TileRaceTierBoardBuilder({
  tiers,
  onChange,
}: ITileRaceTierBoardBuilderProps) {
  const [selected, setSelected] = useState<{
    tier: number;
    tile: number;
  } | null>(null);

  const updateTier = (tierIndex: number, next: IBoardTileInput[]) =>
    onChange(tiers.map((tier, i) => (i === tierIndex ? next : tier)));

  const updateTile = (
    tierIndex: number,
    tileIndex: number,
    patch: Partial<IBoardTileInput>,
  ) =>
    updateTier(
      tierIndex,
      tiers[tierIndex].map((tile, i) =>
        i === tileIndex ? { ...tile, ...patch } : tile,
      ),
    );

  const appendTile = (tierIndex: number) => {
    if (tiers[tierIndex].length >= MAX_TIER_SIZE) {
      return;
    }
    updateTier(tierIndex, [...tiers[tierIndex], NEW_TILE]);
    setSelected({ tier: tierIndex, tile: tiers[tierIndex].length });
  };

  const removeTile = (tierIndex: number, tileIndex: number) => {
    updateTier(
      tierIndex,
      tiers[tierIndex].filter((_, i) => i !== tileIndex),
    );
    setSelected(null);
  };

  const moveTile = (tierIndex: number, tileIndex: number, delta: -1 | 1) => {
    const tier = tiers[tierIndex];
    const target = tileIndex + delta;
    if (target < 0 || target >= tier.length) {
      return;
    }
    updateTier(
      tierIndex,
      tier.map((tile, i) =>
        i === tileIndex ? tier[target] : i === target ? tier[tileIndex] : tile,
      ),
    );
    setSelected({ tier: tierIndex, tile: target });
  };

  const addTier = () => {
    onChange([...tiers, [NEW_TILE]]);
    setSelected({ tier: tiers.length, tile: 0 });
  };

  const removeTier = (tierIndex: number) => {
    onChange(tiers.filter((_, i) => i !== tierIndex));
    setSelected(null);
  };

  const moveTier = (tierIndex: number, delta: -1 | 1) => {
    const target = tierIndex + delta;
    if (target < 0 || target >= tiers.length) {
      return;
    }
    onChange(
      tiers.map((tier, i) =>
        i === tierIndex ? tiers[target] : i === target ? tiers[tierIndex] : tier,
      ),
    );
    setSelected(null);
  };

  const selectedTile =
    selected !== null ? tiers[selected.tier]?.[selected.tile] : null;

  return (
    <Box>
      <Flex direction="column" gap="3">
        {tiers.map((tier, tierIndex) => (
          <Box key={tierIndex}>
            <Flex align="center" justify="between" gap="3" wrap="wrap">
              <Text size="3" className="text-osrs-orange">
                Tier {tierIndex + 1}{' '}
                <span className="text-gray-500">
                  · {tier.length} tile{tier.length === 1 ? '' : 's'} · rolls a
                  d{tier.length}
                </span>
              </Text>
              <Flex gap="2">
                <Button
                  type="button"
                  onClick={() => moveTier(tierIndex, -1)}
                  disabled={tierIndex === 0}
                >
                  ▲
                </Button>
                <Button
                  type="button"
                  onClick={() => moveTier(tierIndex, 1)}
                  disabled={tierIndex === tiers.length - 1}
                >
                  ▼
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => removeTier(tierIndex)}
                >
                  Remove tier
                </Button>
              </Flex>
            </Flex>
            <Box mt="1" className="overflow-x-auto">
              <div className="grid min-w-[40rem] grid-cols-10 gap-1">
                {tier.map((tile, tileIndex) => (
                  <BuilderCellView
                    key={tileIndex}
                    cell={{ kind: 'tile', tile, index: tileIndex }}
                    selected={
                      selected?.tier === tierIndex &&
                      selected.tile === tileIndex
                    }
                    onAppend={() => appendTile(tierIndex)}
                    onSelect={tileIndex =>
                      setSelected(current =>
                        current?.tier === tierIndex &&
                        current.tile === tileIndex
                          ? null
                          : { tier: tierIndex, tile: tileIndex },
                      )
                    }
                  />
                ))}
                {tier.length < MAX_TIER_SIZE && (
                  <BuilderCellView
                    cell={{ kind: 'add' }}
                    selected={false}
                    onAppend={() => appendTile(tierIndex)}
                    onSelect={() => {}}
                  />
                )}
              </div>
            </Box>
          </Box>
        ))}
      </Flex>
      <Box mt="3">
        <Button type="button" onClick={addTier}>
          ＋ Add tier
        </Button>
      </Box>

      {selectedTile && selected !== null && (
        <Box
          mt="3"
          className="border-t-2 border-t-sanguine-red bg-sanguine-red/[0.04] p-3"
        >
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Text size="4" className="text-osrs-orange">
              Tier {selected.tier + 1}, tile {selected.tile + 1} of{' '}
              {tiers[selected.tier].length}
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button
                type="button"
                onClick={() => moveTile(selected.tier, selected.tile, -1)}
                disabled={selected.tile === 0}
              >
                ◀ Move
              </Button>
              <Button
                type="button"
                onClick={() => moveTile(selected.tier, selected.tile, 1)}
                disabled={selected.tile === tiers[selected.tier].length - 1}
              >
                Move ▶
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => removeTile(selected.tier, selected.tile)}
              >
                Delete
              </Button>
            </Flex>
          </Flex>
          <Flex mt="3" gap="4" wrap="wrap" align="end">
            <TaskTileFields
              tile={selectedTile}
              onPatch={patch =>
                updateTile(selected.tier, selected.tile, patch)
              }
            />
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
        <span className="text-sm text-green-400">
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
        <span className="text-xl text-gray-400">＋</span>
      </button>
    );
  }

  const { tile, index } = cell;
  const imageUrl =
    tile.type === 'TASK'
      ? (tile.imageUrl ?? getTileImageUrl(tile.name, tile.description))
      : null;
  const content =
    tile.type === 'GO_BACK' ? (
      <span className="text-[13px] leading-tight text-red-400">
        Go back {tile.amount}
      </span>
    ) : tile.type === 'GO_FORWARD' ? (
      <span className="text-[13px] leading-tight text-sky-400">
        Forward {tile.amount}
      </span>
    ) : tile.name?.trim() ? (
      <span className="text-[13px] leading-tight text-gray-200">
        {tile.name}
      </span>
    ) : (
      <span className="text-[13px] leading-tight text-gray-500">
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
      {imageUrl && <TileArt src={imageUrl} />}
      <span className="absolute left-1 top-0.5 text-[11px] text-gray-600">
        {index + 1}
      </span>
      {tile.type === 'TASK' && (tile.quantity ?? 1) > 1 && (
        <span className="absolute right-1 top-0.5 text-[11px] text-osrs-gold">
          ×{tile.quantity}
        </span>
      )}
      {/* relative lifts the label above the absolutely-positioned artwork */}
      <span className="relative">{content}</span>
    </button>
  );
}
