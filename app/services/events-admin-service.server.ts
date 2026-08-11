import * as process from 'process';
import type {
  ITileRace,
  ITileRaceStanding,
} from '~/services/tile-race-service.server';
import type { IBoardTileInput } from '~/utils/tile-race-board';

/**
 * Client for the sanguine-events admin API (bearer service token). Every call
 * carries the acting staff member's Discord id in x-acting-user so the events
 * service attributes announcements and audits to a human, not to the website.
 */
const EVENTS_API_URL = process.env.EVENTS_API_URL ?? 'http://localhost:8080';
const EVENTS_API_TOKEN = process.env.EVENTS_API_TOKEN ?? '';
const EVENTS_API_TIMEOUT_MS = 10_000;

/** Admin standings carry member rosters; the public payload deliberately doesn't. */
export interface IAdminStanding extends ITileRaceStanding {
  memberDiscordIds: string[];
}

export interface IAdminTileRace extends Omit<ITileRace, 'standings'> {
  standings: IAdminStanding[];
  channels: {
    approvalsChannelId: string;
    announcementsChannelId: string;
  };
}

export interface ICreateRaceInput {
  name: string;
  diceSides: number;
  tiles: IBoardTileInput[];
  approvalsChannelId: string;
  announcementsChannelId: string;
  days: number;
}

/** An expected rejection from the events API (validation, rule violations). */
export class EventsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'EventsApiError';
  }
}

const adminRequest = async <T>(
  path: string,
  init?: { method?: string; body?: unknown; actingUserId?: string },
): Promise<T> => {
  const response = await fetch(`${EVENTS_API_URL}/admin${path}`, {
    method: init?.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${EVENTS_API_TOKEN}`,
      ...(init?.actingUserId ? { 'x-acting-user': init.actingUserId } : {}),
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(EVENTS_API_TIMEOUT_MS),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new EventsApiError(
      payload?.error ?? `Events API returned ${response.status}`,
      response.status,
    );
  }
  return (await response.json()) as T;
};

/**
 * The open race with rosters and admin-only config, or null when there isn't one.
 * Reads need no acting user — the public /tile-race page also uses this server-side
 * to resolve rosters, since the public API payload deliberately omits Discord ids.
 */
export const getAdminRace = async (): Promise<IAdminTileRace | null> => {
  try {
    return await adminRequest<IAdminTileRace>('/races/current', {
      method: 'GET',
    });
  } catch (e) {
    if (e instanceof EventsApiError && e.status === 404) {
      return null;
    }
    throw e;
  }
};

export const createRace = (input: ICreateRaceInput, actingUserId: string) =>
  adminRequest<{ eventId: string }>('/races', {
    actingUserId,
    body: {
      name: input.name,
      board: { diceSides: input.diceSides, tiles: input.tiles },
      approvalsChannelId: input.approvalsChannelId,
      announcementsChannelId: input.announcementsChannelId,
      days: input.days,
    },
  });

export const startRace = (actingUserId: string) =>
  adminRequest<{ started: boolean; teamCount: number }>(
    '/races/current/start',
    { actingUserId },
  );

export const endRace = (actingUserId: string) =>
  adminRequest<IAdminTileRace>('/races/current/end', { actingUserId });

export const cancelRace = (actingUserId: string) =>
  adminRequest<{ cancelled: boolean }>('/races/current/cancel', {
    actingUserId,
  });

export const addTeam = (
  name: string,
  memberDiscordIds: string[],
  actingUserId: string,
) =>
  adminRequest<{ teamId: string; name: string }>('/races/current/teams', {
    actingUserId,
    body: { name, memberDiscordIds },
  });

export const removeTeam = (name: string, actingUserId: string) =>
  adminRequest<{ removed: boolean }>(
    `/races/current/teams/${encodeURIComponent(name)}`,
    { method: 'DELETE', actingUserId },
  );

export const moveTeam = (name: string, tile: number, actingUserId: string) =>
  adminRequest<{ tileIndex: number }>(
    `/races/current/teams/${encodeURIComponent(name)}/move`,
    { actingUserId, body: { tile } },
  );

export const completeTeamTask = (name: string, actingUserId: string) =>
  adminRequest<{ tileIndex: number }>(
    `/races/current/teams/${encodeURIComponent(name)}/complete`,
    { actingUserId },
  );

export const rerollTeam = (name: string, actingUserId: string) =>
  adminRequest<{ tileIndex: number }>(
    `/races/current/teams/${encodeURIComponent(name)}/reroll`,
    { actingUserId },
  );
