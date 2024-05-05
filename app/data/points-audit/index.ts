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
