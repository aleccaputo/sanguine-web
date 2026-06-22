import { prisma } from '~/utils/db.server';

export type MonthlyWinnerEventType = 'BOSS' | 'RAID' | 'SKILL';

export type MonthlyWinner = {
  eventId: string;
  type: MonthlyWinnerEventType;
  metric: string | null;
  winnerDiscordId: string;
  winnerOsrsName: string | null;
  startDate: string;
  endDate: string;
};

const isRealWinnerId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0 && value !== 'NONE';

export const getMonthlyWinners = async (): Promise<MonthlyWinner[]> => {
  const [events, polls] = await Promise.all([
    prisma.clanEvents.findMany({
      where: { type: { in: ['BOSS', 'RAID', 'SKILL'] } },
    }),
    prisma.eventPolls.findMany({
      where: { relatedClanEventId: { not: null } },
    }),
  ]);

  const metricByEventId = new Map(
    polls
      .filter(p => p.relatedClanEventId)
      .map(p => [p.relatedClanEventId as string, p.winnerMetric ?? null]),
  );

  return events
    .filter(e => isRealWinnerId(e.winnerDiscordId))
    .map(e => ({
      eventId: e.id,
      type: e.type as MonthlyWinnerEventType,
      metric: metricByEventId.get(e.id) ?? null,
      winnerDiscordId: e.winnerDiscordId as string,
      winnerOsrsName: e.winnerOsrsName ?? null,
      startDate: e.startDate,
      endDate: e.endDate,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
};

export const getUpcomingEventEndDates = async (): Promise<
  Record<MonthlyWinnerEventType, string | null>
> => {
  const now = new Date().toISOString();
  const events = await prisma.clanEvents.findMany({
    where: {
      type: { in: ['BOSS', 'RAID', 'SKILL'] },
      endDate: { gt: now },
    },
  });

  const nearestEndDate = (type: MonthlyWinnerEventType) =>
    events
      .filter(e => e.type === type)
      .map(e => e.endDate)
      .sort()[0] ?? null;

  return {
    BOSS: nearestEndDate('BOSS'),
    RAID: nearestEndDate('RAID'),
    SKILL: nearestEndDate('SKILL'),
  };
};
