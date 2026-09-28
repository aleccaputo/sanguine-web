import { MOCK_PERSONAL_BESTS } from '~/mocks/fixtures.server';
import type {
  IPersonalBest,
  IPersonalBestParticipation,
} from '~/data/personal-bests';
import { comparePbTimes } from '~/utils/personal-bests';

const ranked = (rows: IPersonalBest[]) => [...rows].sort(comparePbTimes);

export const getAllPersonalBests = async (): Promise<IPersonalBest[]> =>
  ranked(MOCK_PERSONAL_BESTS);

export const getPersonalBestCategoryKeysForDiscordId = async (
  discordId: string,
): Promise<string[]> => [
  ...new Set(
    MOCK_PERSONAL_BESTS.filter(pb =>
      pb.participantDiscordIds.includes(discordId),
    ).map(pb => pb.categoryKey),
  ),
];

export const getPersonalBestsByCategoryKeys = async (
  categoryKeys: string[],
): Promise<IPersonalBest[]> =>
  ranked(
    MOCK_PERSONAL_BESTS.filter(pb => categoryKeys.includes(pb.categoryKey)),
  );

export const getPersonalBestsSince = async (
  since: string,
): Promise<IPersonalBestParticipation[]> =>
  MOCK_PERSONAL_BESTS.filter(pb => pb.createdAt >= since).map(
    ({ categoryKey, participantDiscordIds, createdAt }) => ({
      categoryKey,
      participantDiscordIds,
      createdAt,
    }),
  );
