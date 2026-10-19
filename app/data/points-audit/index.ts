import { prisma } from '~/utils/db.server';
import type { DropAuditRow } from '~/utils/clan-firsts';

// Skip purchases subtract from the stored clanPoints balance. Sums the (negative) purchase
// audits per member so displays can add the spend back — the roster and leaderboard show
// lifetime earned clan points, not the current balance.
export const getSkipPurchaseSpendByDiscordId = async (): Promise<
  Record<string, number>
> => {
  const rows = await prisma.pointAudit.groupBy({
    by: ['destinationDiscordId'],
    where: { type: 'BOSS_WHEEL_SKIP_PURCHASE' },
    _sum: { pointsGiven: true },
  });
  return Object.fromEntries(
    rows.map(row => [
      row.destinationDiscordId,
      Math.abs(row._sum.pointsGiven ?? 0),
    ]),
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

/** Every audit row on or after `since` (ISO), only the fields engagement counting needs. */
export const getAuditEventsSince = (since: string) =>
  prisma.pointAudit.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, destinationDiscordId: true, createdAt: true },
  });

// Every AUTOMATED drop (Dink or /givedrop) of the given items, oldest first. Matched by the
// stamped item name (normalized, as the bot stores it) or, for rows that predate the name, by
// item id.
export const getDropAuditsForItems = async (
  itemNames: string[],
  itemIds: number[],
): Promise<DropAuditRow[]> => {
  const matchers = [
    ...(itemNames.length > 0 ? [{ itemName: { in: itemNames } }] : []),
    ...(itemIds.length > 0 ? [{ itemId: { in: itemIds } }] : []),
  ];
  if (matchers.length === 0) return [];
  return prisma.pointAudit.findMany({
    where: {
      type: 'AUTOMATED',
      OR: matchers,
    },
    select: {
      destinationDiscordId: true,
      createdAt: true,
      osrsName: true,
      itemId: true,
      itemName: true,
    },
    orderBy: { createdAt: 'asc' },
  });
};
