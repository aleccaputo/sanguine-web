import { MOCK_DROPS } from '~/mocks/fixtures.server';
import { isLegacyCompetitionAudit } from '~/utils/point-types';

export const getLegacyCompetitionPointsByDiscordId = async (): Promise<
  Record<string, number>
> =>
  MOCK_DROPS.filter(isLegacyCompetitionAudit).reduce<Record<string, number>>(
    (acc, d) => ({
      ...acc,
      [d.destinationDiscordId]:
        (acc[d.destinationDiscordId] ?? 0) + d.pointsGiven,
    }),
    {},
  );

export const getAuditDataForDateRange = async (
  startDate: string,
  endDate: string,
) =>
  MOCK_DROPS.filter(d => d.createdAt >= startDate && d.createdAt <= endDate);

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
