import type {
  CompetitionDetails,
  CompetitionListItem,
  MembershipWithPlayer,
} from '@wise-old-man/utils';
import {
  MOCK_COMPETITIONS,
  MOCK_GROUP_MEMBERSHIPS,
  buildCompetitionDetail,
} from '~/mocks/fixtures.server';

export const getCompetitions = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit?: number,
): Promise<CompetitionListItem[] | undefined> =>
  MOCK_COMPETITIONS as unknown as CompetitionListItem[];

export const getCompetitionById = async (
  id: number,
): Promise<CompetitionDetails> =>
  buildCompetitionDetail(id) as unknown as CompetitionDetails;

export const getClanFromWom = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id: number,
): Promise<MembershipWithPlayer[]> =>
  MOCK_GROUP_MEMBERSHIPS as unknown as MembershipWithPlayer[];
