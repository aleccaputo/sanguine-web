import type {
  CompetitionDetailsResponse,
  CompetitionResponse,
} from '@wise-old-man/utils';
import {
  MOCK_COMPETITIONS,
  MOCK_GROUP_MEMBERSHIPS,
  buildCompetitionDetail,
} from '~/mocks/fixtures.server';
import type { MembershipWithPlayer } from '~/services/wom-api-service.server';

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
