import * as process from 'process';

/**
 * Client for the sanguine-events HTTP API (the events bot's sibling deployable).
 * The current-race endpoint is public — no auth. This module owns only the I/O
 * (and is swapped for app/mocks/tile-race-service.server.ts under MOCK_MODE);
 * board shapes mirror the API's public serializer.
 */
const EVENTS_API_URL = process.env.EVENTS_API_URL ?? 'http://localhost:8080';

// A hung connection must abort rather than hold every awaiting loader open.
const EVENTS_API_TIMEOUT_MS = 8_000;

export type TileType = 'START' | 'FINISH' | 'TASK' | 'GO_BACK' | 'GO_FORWARD';

export type MoveStatus = 'PENDING_SUBMISSION' | 'PENDING_APPROVAL' | 'COMPLETED';

/**
 * TIERED races split the board into tiers of TASK tiles: each roll uses a die
 * sized to the team's next tier and picks that tier's task directly, one task
 * per tier. CLASSIC is the linear dice race. Optional for rollout safety —
 * absent means CLASSIC.
 */
export type RaceMode = 'CLASSIC' | 'TIERED';

export interface ITileRaceTile {
  index: number;
  type: TileType;
  /** TASK tiles */
  name?: string;
  description?: string;
  /** TASK tiles: admin-picked OSRS wiki artwork */
  imageUrl?: string;
  /** TASK tiles: approved submissions required to complete the tile (absent = 1) */
  quantity?: number;
  /** GO_BACK / GO_FORWARD tiles */
  amount?: number;
  /** Tiered boards: 1-based tier this tile belongs to (0 = START) */
  tier?: number;
}

export interface ITileRaceStanding {
  teamId: string;
  name: string;
  /** 1-based finishing place, null while still racing */
  place: number | null;
  tileIndex: number;
  finishIndex: number;
  /** Tiered races: the team's current tier / total tiers; null on classic */
  tier?: number | null;
  tierCount?: number | null;
  currentTask: string | null;
  moveStatus: MoveStatus | null;
  isFinished: boolean;
}

export interface ITileRace {
  event: {
    id: string;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startDate: string;
    endDate: string;
  };
  board: {
    mode?: RaceMode;
    diceSides: number;
    /** Task/movement tiles between START and FINISH */
    tileCount: number;
    /** Tiered boards: task-tile count per tier, in board order; null on classic */
    tierSizes?: number[] | null;
    tiles: ITileRaceTile[];
    /** Admin payload only: optimistic-concurrency token for board edits */
    version?: number;
  };
  standings: ITileRaceStanding[];
}

/** The open (draft or running) tile race, or null when there isn't one. */
export const getCurrentTileRace = async (): Promise<ITileRace | null> => {
  const response = await fetch(`${EVENTS_API_URL}/races/current`, {
    signal: AbortSignal.timeout(EVENTS_API_TIMEOUT_MS),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Events API returned ${response.status}`);
  }
  return (await response.json()) as ITileRace;
};
