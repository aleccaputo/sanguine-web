import { MOCK_PERSONAL_BESTS } from '~/mocks/fixtures.server';
import type {
  IPersonalBest,
  IPersonalBestParticipation,
} from '~/data/personal-bests';
import { comparePbTimes, isDefunctPersonalBest } from '~/utils/personal-bests';

// Same screening and ranking as the real data layer.
const ranked = (rows: IPersonalBest[]) =>
  rows.filter(pb => !isDefunctPersonalBest(pb)).sort(comparePbTimes);

export const getAllPersonalBests = async (): Promise<IPersonalBest[]> =>
  ranked(MOCK_PERSONAL_BESTS);

export const getPersonalBestCategoryKeysForDiscordId = async (
  discordId: string,
): Promise<string[]> => [
  ...new Set(
    MOCK_PERSONAL_BESTS.filter(
      pb =>
        pb.participantDiscordIds.includes(discordId) &&
        !isDefunctPersonalBest(pb),
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
