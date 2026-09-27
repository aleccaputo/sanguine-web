import type {
  CompetitionDetailsResponse,
  CompetitionResponse,
} from '@wise-old-man/utils';
import {
  MOCK_COMPETITIONS,
  MOCK_GROUP_MEMBERSHIPS,
  buildCompetitionDetail,
} from '~/mocks/fixtures.server';
import type {
  IMemberGain,
  MembershipWithPlayer,
} from '~/services/wom-api-service.server';

export const getCompetitions = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit?: number,
): Promise<CompetitionResponse[] | undefined> =>
  MOCK_COMPETITIONS as unknown as CompetitionResponse[];

export const getCompetitionById = async (
  id: number,
): Promise<CompetitionDetailsResponse> =>
  buildCompetitionDetail(id) as unknown as CompetitionDetailsResponse;

export const getClanFromWom = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id?: number,
): Promise<MembershipWithPlayer[]> =>
  MOCK_GROUP_MEMBERSHIPS as unknown as MembershipWithPlayer[];

// Deterministic fake gains: a stable hash of metric + member + window decides who "did the
// content" and how much, so a bounty's scorecard reads the same on every reload.
const hash = (input: string) =>
  [...input].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);

export const getGroupGainsForWindow = async (
  metric: string,
  startDate: Date,
  endDate: Date,
): Promise<IMemberGain[]> => {
  const windowKey = `${metric}|${startDate.toISOString()}|${endDate.toISOString()}`;
  return MOCK_GROUP_MEMBERSHIPS.map(({ player }) => {
    const roll = hash(`${windowKey}|${player.username}`);
    const active = roll % 100 < (metric === 'ehb' ? 55 : 30);
    const gained = active
      ? metric === 'ehb'
        ? ((roll >> 8) % 400) / 10
        : ((roll >> 8) % 120) + 1
      : 0;
    return {
      username: player.username,
      displayName: player.displayName,
      start: 1000,
      end: 1000 + gained,
      gained,
    };
  });
};
