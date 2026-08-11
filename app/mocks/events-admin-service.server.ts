import type { IAdminTileRace } from '../services/events-admin-service.server';
import { mockAdminRaceBase } from './tile-race-service.server';

// MOCK_MODE stand-in for the sanguine-events admin API: serves the shared fixture with
// admin channel config bolted on; mutations succeed without doing anything (the fixture
// is static).

export class EventsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'EventsApiError';
  }
}

// MOCK_EMPTY_RACE=1 makes the portal show the create-race form instead of the dashboard
export const getAdminRace = async (): Promise<IAdminTileRace | null> =>
  process.env.MOCK_EMPTY_RACE === '1'
    ? null
    : {
        ...mockAdminRaceBase,
        channels: {
          approvalsChannelId: '200000000000000002',
          announcementsChannelId: '200000000000000001',
        },
      };

const ok = async <T>(value: T): Promise<T> => value;

export const createRace = () => ok({ eventId: 'mock-race' });
export const startRace = () => ok({ started: true, teamCount: 4 });
export const endRace = async (): Promise<IAdminTileRace> => {
  const race = await getAdminRace();
  if (!race) throw new EventsApiError('No open tile race', 404);
  return race;
};
export const cancelRace = () => ok({ cancelled: true });
export const addTeam = () => ok({ teamId: 'mock-team', name: 'Mock Team' });
export const updateTeam = (
  name: string,
  patch: { name?: string; memberDiscordIds?: string[] },
) =>
  ok({
    name: patch.name ?? name,
    memberDiscordIds: patch.memberDiscordIds ?? [],
  });
export const removeTeam = () => ok({ removed: true });
export const moveTeam = () => ok({ tileIndex: 1 });
export const completeTeamTask = () => ok({ tileIndex: 2 });
export const rerollTeam = () => ok({ tileIndex: 3 });
