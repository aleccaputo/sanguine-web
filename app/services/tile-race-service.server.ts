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

export interface ITileRaceTile {
  index: number;
  type: TileType;
  /** TASK tiles */
  name?: string;
  description?: string;
  /** TASK tiles: admin-picked OSRS wiki artwork */
  imageUrl?: string;
  /** GO_BACK / GO_FORWARD tiles */
  amount?: number;
}

export interface ITileRaceStanding {
  teamId: string;
  name: string;
  /** 1-based finishing place, null while still racing */
  place: number | null;
  tileIndex: number;
  finishIndex: number;
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
    diceSides: number;
    /** Task/movement tiles between START and FINISH */
    tileCount: number;
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
