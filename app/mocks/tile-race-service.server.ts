import type {
  ITileRace,
  ITileRaceStanding,
  ITileRaceTile,
} from '../services/tile-race-service.server';
import type { IAdminTileRace } from '../services/events-admin-service.server';
import { MOCK_USERS } from '~/mocks/fixtures.server';

const roster = (from: number, to: number) =>
  MOCK_USERS.slice(from, to).map(u => u.discordId);

// Deterministic fixture standing in for the sanguine-events API under MOCK_MODE:
// a mid-race board with movement tiles, one finished team, one awaiting approval.

const task = (name: string, description?: string): ITileRaceTile => ({
  index: 0,
  type: 'TASK',
  name,
  description,
});
const goBack = (amount: number): ITileRaceTile => ({
  index: 0,
  type: 'GO_BACK',
  amount,
});
const goForward = (amount: number): ITileRaceTile => ({
  index: 0,
  type: 'GO_FORWARD',
  amount,
});

const innerTiles: ITileRaceTile[] = [
  task('60KC @ Barrows', 'Any team member reaches 60 Barrows KC gained during the event'),
  task('Any GWD unique', 'Any unique drop from any God Wars Dungeon boss'),
  task('50KC @ Moons', '50 Moons of Peril completions'),
  goBack(1),
  task('Any raid unique', 'Any unique from CoX, ToB, or ToA'),
  task('Melee fight cave', 'Complete the Fight Caves using only melee'),
  goForward(3),
  task('100KC @ Vorkath'),
  {
    // Counted tile: each approved drop ticks progress, 10 complete it
    index: 0,
    type: 'TASK',
    name: '10 KBD heads',
    description: 'One head per approved submission, ten clear the tile',
    quantity: 10,
  },
  task('3000 pts in one Wintertodt game'),
  goBack(3),
  {
    // Exercises the admin-picked artwork path: no keyword rule matches this
    // name, so the art can only come from the explicit imageUrl.
    index: 0,
    type: 'TASK',
    name: 'Reach 6hr log',
    description: 'Screenshot the 6 hour login timer',
    imageUrl: 'https://oldschool.runescape.wiki/images/Watch_detail.png',
  },
  task('Colosseum unique'),
  task('50KC @ Scurrius'),
  task('Any Moons unique'),
  goForward(2),
  task('Kill Yard using level 60 gear'),
  task('150KC @ Vardorvis'),
  task('Any rev unique'),
  goBack(2),
  task('100KC @ Muspah'),
  task('Nightmare unique'),
  task('250 combined chompy KC'),
  task('Any Leviathan unique'),
  task('Punch Vorkath to death', 'Final blow must be an unarmed punch'),
];

const boardEnds: Record<'start' | 'finish', ITileRaceTile> = {
  start: { index: 0, type: 'START', name: 'Start' },
  finish: { index: 0, type: 'FINISH', name: 'Finish' },
};

const tiles: ITileRaceTile[] = [
  boardEnds.start,
  ...innerTiles,
  boardEnds.finish,
].map((tile, index) => ({ ...tile, index }));

const finishIndex = tiles.length - 1;

// The fixture is admin-shaped (rosters included); the public mock strips the ids,
// mirroring what the real API's public serializer does.
type MockAdminRace = Omit<IAdminTileRace, 'channels'>;

export const mockAdminRaceBase: MockAdminRace = {
  event: {
    id: 'mock-tile-race',
    name: 'Sanguine Tile Race',
    status: 'ACTIVE',
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-15T00:00:00.000Z',
  },
  board: {
    diceSides: 6,
    tileCount: innerTiles.length,
    tiles,
  },
  standings: [
    {
      teamId: 'team-1',
      name: 'Blood Reapers',
      memberDiscordIds: roster(0, 3),
      place: 1,
      tileIndex: finishIndex,
      finishIndex,
      currentTask: null,
      moveStatus: 'COMPLETED',
      isFinished: true,
    },
    {
      teamId: 'team-2',
      name: 'Scythe Squad',
      memberDiscordIds: roster(3, 6),
      place: null,
      tileIndex: 18,
      finishIndex,
      currentTask: '150KC @ Vardorvis',
      moveStatus: 'PENDING_APPROVAL',
      isFinished: false,
    },
    {
      teamId: 'team-3',
      name: 'Gob Squad',
      memberDiscordIds: roster(6, 8),
      place: null,
      tileIndex: 12,
      finishIndex,
      currentTask: 'Reach 6hr log',
      moveStatus: 'PENDING_SUBMISSION',
      isFinished: false,
    },
    {
      teamId: 'team-4',
      name: 'Rune Goons',
      memberDiscordIds: roster(8, 11),
      place: null,
      tileIndex: 12,
      finishIndex,
      currentTask: 'Reach 6hr log',
      moveStatus: 'PENDING_SUBMISSION',
      isFinished: false,
    },
  ],
};

// Tiered fixture (MOCK_TIERED_RACE=1): four tiers of varying size, one task per
// tier — exercises the per-tier board rows, tier standings, and d{size} labels.
const tierBlueprints: ITileRaceTile[][] = [
  [
    task('60KC @ Barrows', 'Any team member reaches 60 Barrows KC gained during the event'),
    task('Full graceful piece'),
    task('Champion scroll'),
  ],
  [
    {
      index: 0,
      type: 'TASK',
      name: '10 KBD heads',
      description: 'One head per approved submission, ten clear the tile',
      quantity: 10,
    },
    task('Punch Vorkath to death', 'Final blow must be an unarmed punch'),
    {
      index: 0,
      type: 'TASK',
      name: 'Reach 6hr log',
      description: 'Screenshot the 6 hour login timer',
      imageUrl: 'https://oldschool.runescape.wiki/images/Watch_detail.png',
    },
    task('Any Zulrah unique'),
    task('Melee fight cave', 'Complete the Fight Caves using only melee'),
  ],
  [task('Any GWD unique'), task('3000 pts in one Wintertodt game')],
  [task('Any raid unique', 'Any unique from CoX, ToB, or ToA')],
];

const tierSizes = tierBlueprints.map(tier => tier.length);

const tieredTiles: ITileRaceTile[] = [
  boardEnds.start,
  ...tierBlueprints.flat(),
  boardEnds.finish,
].map((tile, index) => ({ ...tile, index }));

const tieredFinishIndex = tieredTiles.length - 1;
const tierOf = (tileIndex: number): number =>
  tierSizes.findIndex(
    (_, tier) =>
      tileIndex <= tierSizes.slice(0, tier + 1).reduce((a, b) => a + b, 0),
  ) + 1;

export const mockTieredAdminRaceBase: MockAdminRace = {
  event: {
    id: 'mock-tiered-race',
    name: 'Sanguine Tier Race',
    status: 'ACTIVE',
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-15T00:00:00.000Z',
  },
  board: {
    mode: 'TIERED',
    diceSides: 6,
    tileCount: tieredTiles.length - 2,
    tierSizes,
    tiles: tieredTiles.map(tile => ({
      ...tile,
      tier:
        tile.type === 'START'
          ? 0
          : tile.type === 'FINISH'
            ? tierSizes.length + 1
            : tierOf(tile.index),
    })),
  },
  standings: [
    {
      teamId: 'team-1',
      name: 'Blood Reapers',
      memberDiscordIds: roster(0, 3),
      place: 1,
      tileIndex: tieredFinishIndex,
      finishIndex: tieredFinishIndex,
      tier: tierSizes.length + 1,
      tierCount: tierSizes.length,
      currentTask: null,
      moveStatus: 'COMPLETED',
      isFinished: true,
    },
    {
      teamId: 'team-2',
      name: 'Scythe Squad',
      memberDiscordIds: roster(3, 6),
      place: null,
      tileIndex: 4,
      finishIndex: tieredFinishIndex,
      tier: 2,
      tierCount: tierSizes.length,
      currentTask: '10 KBD heads (3/10)',
      moveStatus: 'PENDING_APPROVAL',
      isFinished: false,
    },
    {
      teamId: 'team-3',
      name: 'Gob Squad',
      memberDiscordIds: roster(6, 8),
      place: null,
      tileIndex: 2,
      finishIndex: tieredFinishIndex,
      tier: 1,
      tierCount: tierSizes.length,
      currentTask: 'Full graceful piece',
      moveStatus: 'PENDING_SUBMISSION',
      isFinished: false,
    },
  ],
};

/** The fixture the mocks serve: tiered under MOCK_TIERED_RACE=1, else classic. */
export const getMockAdminRaceBase = (): MockAdminRace =>
  process.env.MOCK_TIERED_RACE === '1'
    ? mockTieredAdminRaceBase
    : mockAdminRaceBase;

const toPublicStanding = (
  standing: MockAdminRace['standings'][number],
): ITileRaceStanding => ({
  teamId: standing.teamId,
  name: standing.name,
  place: standing.place,
  tileIndex: standing.tileIndex,
  finishIndex: standing.finishIndex,
  tier: standing.tier ?? null,
  tierCount: standing.tierCount ?? null,
  currentTask: standing.currentTask,
  moveStatus: standing.moveStatus,
  isFinished: standing.isFinished,
});

export const getCurrentTileRace = async (): Promise<ITileRace | null> => {
  const base = getMockAdminRaceBase();
  return { ...base, standings: base.standings.map(toPublicStanding) };
};
