import { prisma } from '~/utils/db.server';

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
