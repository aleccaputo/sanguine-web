import { faker } from '@faker-js/faker';
import { MOCK_USERS } from '~/mocks/fixtures.server';
import type { ClearFirstRow, DropFirstRow } from '~/utils/clan-firsts';

// Seeded per item id so each board renders the same between reloads: some full, some partial,
// some empty, with repeat drops that must not take a second spot.
export const getDropAuditsForItems = async (
  itemIds: number[],
  since: string,
): Promise<Array<DropFirstRow & { itemId: number | null }>> =>
  itemIds.flatMap(itemId => {
    faker.seed(itemId);
    const count = faker.number.int({ min: 0, max: 8 });
    return Array.from({ length: count }, () => {
      const user = faker.helpers.arrayElement(MOCK_USERS.slice(0, 8));
      return {
        itemId,
        destinationDiscordId: user.discordId,
        osrsName: user.nickname,
        createdAt: faker.date
          .between({ from: since, to: '2026-11-15' })
          .toISOString(),
      };
    });
  });

// Overlapping teams so the net-new rule (partial credit, skipped all-placed teams) shows.
export const getRaidCompletionsForMetric = async (
  _raidMetric: string,
  since: string,
): Promise<ClearFirstRow[]> => {
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
