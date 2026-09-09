import type {
  ITileRace,
  ITileRaceHistoryEntry,
  ITileRaceStanding,
  ITileRaceTile,
} from '../services/tile-race-service.server';
import type { IAdminTileRace } from '../services/events-admin-service.server';
import { MOCK_USERS } from '~/mocks/fixtures.server';

const roster = (from: number, to: number) =>
  MOCK_USERS.slice(from, to).map(u => u.discordId);

/** A completed-move history entry: tile cleared, when, by whom, and the drop note. */
const cleared = (
  tileIndex: number,
  day: number,
  submitterIndex: number,
  note?: string,
  tier?: number,
): ITileRaceHistoryEntry => ({
  tileIndex,
  tier: tier ?? null,
  isFinish: false,
  rollValue: null,
  note: note ?? null,
  completedAt: `2026-08-${String(day).padStart(2, '0')}T18:30:00.000Z`,
  submittedByDiscordId: MOCK_USERS[submitterIndex].discordId,
});

const crossedLine = (
  tileIndex: number,
  day: number,
  tier?: number,
): ITileRaceHistoryEntry => ({
  tileIndex,
  tier: tier ?? null,
  isFinish: true,
  rollValue: null,
  note: null,
  completedAt: `2026-08-${String(day).padStart(2, '0')}T20:00:00.000Z`,
  submittedByDiscordId: null,
});

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
  task(
    '60KC @ Barrows',
    'Any team member reaches 60 Barrows KC gained during the event',
  ),
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
      history: [
        cleared(3, 2, 0),
        cleared(9, 4, 1, '10th head finally'),
        cleared(15, 6, 2, 'Eclipse moon chestplate'),
        cleared(19, 8, 0, "Craw's bow"),
        cleared(25, 10, 1),
        crossedLine(26, 10),
      ],
    },
    {
      teamId: 'team-2',
      name: 'Scythe Squad',
      // Oversized roster: exercises the standings "+N more" truncation
      memberDiscordIds: roster(3, 26),
      place: null,
      tileIndex: 18,
      finishIndex,
      currentTask: '150KC @ Vardorvis',
      moveStatus: 'PENDING_APPROVAL',
      isFinished: false,
      history: [
        cleared(2, 3, 4, 'Saradomin hilt LOL'),
        cleared(8, 6, 5),
        cleared(12, 9, 6),
      ],
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
      history: [cleared(1, 4, 6), cleared(6, 7, 7)],
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
      history: [
        cleared(5, 5, 8, 'Dust... at least it counts'),
        cleared(10, 8, 9),
      ],
    },
  ],
};

// Tiered fixture (MOCK_TIERED_RACE=1): six tiers sized like a real event, one
// task per tier — exercises the per-tier board rows, tier standings, d{size}
// labels, a counted tile, admin-picked artwork, and two teams sharing a tile.
const tierBlueprints: ITileRaceTile[][] = [
  [
    task('50KC @ Scurrius'),
    task('30KC @ Moons', '30 Moons of Peril completions'),
    task('Any Barrows unique'),
    {
      index: 0,
      type: 'TASK',
      name: '10 KBD heads',
      description: 'One head per approved submission, ten clear the tile',
      quantity: 10,
    },
    task('Champion scroll'),
  ],
  [
    task('Any GWD unique'),
    task('100KC @ Vorkath'),
    task('3000 pts in one Wintertodt game'),
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
  [
    task(
      'Any DT2 unique',
      'Any unique from Vardorvis, Leviathan, Whisperer, or Duke',
    ),
    task('150KC @ Vardorvis'),
    task('Nightmare unique'),
    task('250 combined chompy KC'),
  ],
  [
    task('Any CoX unique'),
    task('Any ToB unique'),
    task('Any ToA unique'),
    task('Punch Vorkath to death', 'Final blow must be an unarmed punch'),
    task('Colosseum unique'),
    task('Any Nex unique'),
  ],
  [
    task('Sub-18min ToB', 'Any scale, in-game timer'),
    task('Awakened DT2 kill', 'Any awakened DT2 boss kill'),
    task('500 invocation ToA'),
  ],
  [
    task('Infernal cape', 'Earned during the event'),
    task("Sol Heredit's quiver"),
  ],
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
      memberDiscordIds: roster(0, 4),
      place: 1,
      tileIndex: tieredFinishIndex,
      finishIndex: tieredFinishIndex,
      tier: tierSizes.length + 1,
      tierCount: tierSizes.length,
      currentTask: null,
      moveStatus: 'COMPLETED',
      isFinished: true,
      history: [
        cleared(2, 2, 0, undefined, 1),
        cleared(9, 4, 1, undefined, 2),
        cleared(14, 6, 0, "Inquisitor's mace!", 3),
        cleared(16, 9, 2, 'Dex scroll from a solo', 4),
        cleared(23, 11, 0, undefined, 5),
        cleared(26, 13, 3, 'quiver GET', 6),
        crossedLine(27, 13, 7),
      ],
    },
    {
      teamId: 'team-2',
      name: 'Scythe Squad',
      memberDiscordIds: roster(4, 8),
      place: null,
      tileIndex: 23,
      finishIndex: tieredFinishIndex,
      tier: 5,
      tierCount: tierSizes.length,
      currentTask: 'Awakened DT2 kill',
      moveStatus: 'PENDING_APPROVAL',
      isFinished: false,
      history: [
        cleared(1, 3, 4, undefined, 1),
        cleared(8, 5, 5, undefined, 2),
        cleared(12, 8, 6, 'Chromium ingot lol', 3),
        cleared(20, 11, 4, 'Echo crystal', 4),
      ],
    },
    {
      teamId: 'team-3',
      name: 'Gob Squad',
      memberDiscordIds: roster(8, 12),
      place: null,
      // Shares the tile with Rune Goons — exercises stacked markers on one tile
      tileIndex: 19,
      finishIndex: tieredFinishIndex,
      tier: 4,
      tierCount: tierSizes.length,
      currentTask: 'Punch Vorkath to death',
      moveStatus: 'PENDING_SUBMISSION',
      isFinished: false,
      history: [
        cleared(5, 4, 8, 'Imp champion scroll?!', 1),
        cleared(11, 7, 9, undefined, 2),
        cleared(15, 10, 10, undefined, 3),
      ],
    },
    {
      teamId: 'team-4',
      name: 'Rune Goons',
      memberDiscordIds: roster(12, 16),
      place: null,
      tileIndex: 19,
      finishIndex: tieredFinishIndex,
      tier: 4,
      tierCount: tierSizes.length,
      currentTask: 'Punch Vorkath to death',
      moveStatus: 'PENDING_SUBMISSION',
      isFinished: false,
      history: [
        cleared(3, 3, 12, "Karil's leathertop", 1),
        cleared(6, 6, 13, 'BCP first GWD trip', 2),
        // Same tier-3 tile Blood Reapers rolled: both teams cleared tile 14,
        // exercising the multi-clear checkmark and stacked popover entries.
        cleared(14, 9, 14, 'Nightmare staff', 3),
      ],
    },
    {
      teamId: 'team-5',
      name: 'Rat Pack',
      memberDiscordIds: roster(16, 20),
      place: null,
      tileIndex: 4,
      finishIndex: tieredFinishIndex,
      tier: 1,
      tierCount: tierSizes.length,
      currentTask: '10 KBD heads (4/10)',
      taskProgress: 4,
      moveStatus: 'PENDING_APPROVAL',
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
  taskProgress: standing.taskProgress ?? null,
  moveStatus: standing.moveStatus,
  isFinished: standing.isFinished,
  // The real public serializer strips submitter ids (PII) — mirror it.
  history: (standing.history ?? []).map(entry => ({
    ...entry,
    submittedByDiscordId: null,
  })),
});

export const getCurrentTileRace = async (): Promise<ITileRace | null> => {
  const base = getMockAdminRaceBase();
  return { ...base, standings: base.standings.map(toPublicStanding) };
};
