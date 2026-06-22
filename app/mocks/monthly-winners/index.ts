import { MOCK_MONTHLY_WINNERS } from '~/mocks/fixtures.server';

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

export const getMonthlyWinners = async (): Promise<MonthlyWinner[]> =>
  MOCK_MONTHLY_WINNERS.map(w => ({
    eventId: w.eventId,
    type: w.type,
    metric: w.metric,
    winnerDiscordId: w.winnerDiscordId,
    winnerOsrsName: w.winnerOsrsName,
    startDate: w.startDate,
    endDate: w.endDate,
  }));

export const getUpcomingEventEndDates = async (): Promise<
  Record<MonthlyWinnerEventType, string | null>
> => {
  const daysOut = (days: number) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return {
    BOSS: daysOut(3),
    RAID: daysOut(5),
    SKILL: daysOut(7),
  };
};
