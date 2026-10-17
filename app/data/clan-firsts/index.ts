import { prisma } from '~/utils/db.server';
import type { ClearFirstRow, DropFirstRow } from '~/utils/clan-firsts';

// Every AUTOMATED drop (Dink or /givedrop) of the given items on or after `since`, oldest first.
export const getDropAuditsForItems = async (
  itemIds: number[],
  since: string,
): Promise<Array<DropFirstRow & { itemId: number | null }>> => {
  if (itemIds.length === 0) return [];
  return prisma.pointAudit.findMany({
    where: {
      type: 'AUTOMATED',
      itemId: { in: itemIds },
      createdAt: { gte: since },
    },
    select: {
      destinationDiscordId: true,
      createdAt: true,
      osrsName: true,
      itemId: true,
    },
    orderBy: { createdAt: 'asc' },
  });
};

// Approved raid completions for one metric approved on or after `since`, oldest first.
export const getRaidCompletionsForMetric = async (
  raidMetric: string,
  since: string,
): Promise<ClearFirstRow[]> =>
  prisma.raidCompletions.findMany({
    where: { raidMetric, approvedAt: { gte: since } },
    select: {
      participantDiscordIds: true,
      approvedAt: true,
      proofMessageUrl: true,
    },
    orderBy: { approvedAt: 'asc' },
  });
