import { prisma } from '~/utils/db.server';
import { COMPETITION_CLAN_POINTS_CUTOVER } from '~/utils/point-types';

// Pre-cutover COMPETITION awards paid into the drop-points bucket on the user record, but
// retroactively count as clan points too. Sums them per member so displays can credit them on
// top of the stored clanPoints total.
export const getLegacyCompetitionPointsByDiscordId = async (): Promise<
  Record<string, number>
> => {
  const rows = await prisma.pointAudit.groupBy({
    by: ['destinationDiscordId'],
    where: {
      type: 'COMPETITION',
      createdAt: { lt: COMPETITION_CLAN_POINTS_CUTOVER },
    },
    _sum: { pointsGiven: true },
  });
  return Object.fromEntries(
    rows.map(row => [row.destinationDiscordId, row._sum.pointsGiven ?? 0]),
  );
};

export const getAuditDataForDateRange = (
  startDate: string,
  endDate: string,
) => {
  return prisma.pointAudit.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
};

export const getAuditDataForUserById = (id: string) => {
  return prisma.pointAudit.findMany({
    where: {
      destinationDiscordId: {
        equals: id,
      },
    },
  });
};

export const getRecentClanDrops = (limit: number = 50) => {
  return prisma.pointAudit.findMany({
    where: {
      type: 'AUTOMATED',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
};

export const getAllClanDrops = () => {
  return prisma.pointAudit.findMany({
    where: { type: 'AUTOMATED' },
    select: {
      id: true,
      itemId: true,
      bossName: true,
      pointsGiven: true,
      createdAt: true,
      destinationDiscordId: true,
      osrsName: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getClanDropsPaginated = async (
  page: number = 1,
  pageSize: number = 10,
) => {
  const skip = (page - 1) * pageSize;

  const [drops, totalCount] = await Promise.all([
    prisma.pointAudit.findMany({
      where: {
        type: 'AUTOMATED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }),
    prisma.pointAudit.count({
      where: {
        type: 'AUTOMATED',
      },
    }),
  ]);

  return {
    drops,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / pageSize),
  };
};
