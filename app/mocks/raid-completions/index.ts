import { MOCK_RAID_COMPLETIONS } from '~/mocks/fixtures.server';
import type {
  IRaidCompletion,
  IRaidCompletionParticipation,
} from '~/data/raid-completions';

const newestFirst = <T extends { approvedAt: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));

export const getRaidCompletionsForDiscordId = async (
  discordId: string,
): Promise<IRaidCompletion[]> =>
  newestFirst(
    MOCK_RAID_COMPLETIONS.filter(raid =>
      raid.participantDiscordIds.includes(discordId),
    ),
  );

export const getRaidCompletionsSince = async (
  since: string,
): Promise<IRaidCompletionParticipation[]> =>
  MOCK_RAID_COMPLETIONS.filter(raid => raid.approvedAt >= since).map(
    ({ raidDisplayName, participantDiscordIds, approvedAt }) => ({
      raidDisplayName,
      participantDiscordIds,
      approvedAt,
    }),
  );
