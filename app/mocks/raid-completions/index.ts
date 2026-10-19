import { faker } from '@faker-js/faker';
import { MOCK_RAID_COMPLETIONS, MOCK_USERS } from '~/mocks/fixtures.server';
import type {
  IRaidCompletion,
  IRaidCompletionParticipation,
} from '~/data/raid-completions';
import type { ClearFirstRow } from '~/utils/clan-firsts';

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

// Overlapping teams so the net-new rule (partial credit, skipped all-placed teams) shows.
export const getRaidCompletionsForMetric = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _raidMetric: string,
): Promise<ClearFirstRow[]> => {
  const since = '2026-10-20T00:00:00.000Z';
  faker.seed(4);
  const pool = MOCK_USERS.slice(0, 14);
  return Array.from({ length: 9 }, (_, i) => ({
    participantDiscordIds: faker.helpers
      .arrayElements(pool, { min: 3, max: 6 })
      .map(user => user.discordId),
    approvedAt: new Date(
      new Date(since).getTime() + (i + 1) * 9 * 60 * 60 * 1000,
    ).toISOString(),
    proofMessageUrl: 'https://discord.com/channels/1/2/3',
  }));
};
