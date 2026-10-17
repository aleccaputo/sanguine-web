import { faker } from '@faker-js/faker';
import { MOCK_DROPS, MOCK_USERS } from '~/mocks/fixtures.server';
import type { DropFirstRow } from '~/utils/clan-firsts';

export const getSkipPurchaseSpendByDiscordId = async (): Promise<
  Record<string, number>
> =>
  MOCK_DROPS.filter(d => d.type === 'BOSS_WHEEL_SKIP_PURCHASE').reduce<
    Record<string, number>
  >(
    (acc, d) => ({
      ...acc,
      [d.destinationDiscordId]:
        (acc[d.destinationDiscordId] ?? 0) + Math.abs(d.pointsGiven),
    }),
    {},
  );

export const getAuditDataForDateRange = async (
  startDate: string,
  endDate: string,
) => MOCK_DROPS.filter(d => d.createdAt >= startDate && d.createdAt <= endDate);

export const getAuditDataForUserById = async (id: string) =>
  MOCK_DROPS.filter(d => d.destinationDiscordId === id);

export const getRecentClanDrops = async (limit: number = 50) =>
  MOCK_DROPS.slice(0, limit);

export const getAllClanDrops = async () =>
  MOCK_DROPS.map(d => ({
    id: d.id,
    itemId: d.itemId,
    bossName: d.bossName,
    pointsGiven: d.pointsGiven,
    createdAt: d.createdAt,
    destinationDiscordId: d.destinationDiscordId,
    osrsName: d.osrsName,
  }));

export const getClanDropsPaginated = async (
  page: number = 1,
  pageSize: number = 10,
) => {
  const skip = (page - 1) * pageSize;
  const totalCount = MOCK_DROPS.length;
  return {
    drops: MOCK_DROPS.slice(skip, skip + pageSize),
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / pageSize),
  };
};

export const getAuditEventsSince = async (since: string) =>
  MOCK_DROPS.filter(d => d.createdAt >= since).map(
    ({ type, destinationDiscordId, createdAt }) => ({
      type,
      destinationDiscordId,
      createdAt,
    }),
  );

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
