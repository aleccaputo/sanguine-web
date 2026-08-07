import { prisma } from '~/utils/db.server';

// Sanguine Slayer rows, written by the Discord bot (which calls the feature the Boss Wheel).
// A WheelEvents row configures one instance of the feature; its window lives on the sibling
// BOSS_WHEEL ClanEvents row. Spins are the task log: one document per assigned task.

export const SPIN_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  REPLACED: 'REPLACED',
  EXPIRED: 'EXPIRED',
} as const;

export const getWheelConfigs = () => prisma.wheelEvents.findMany();

export const getWheelClanEvents = () =>
  prisma.clanEvents.findMany({ where: { type: 'BOSS_WHEEL' } });

/** Completed tasks across every instance — the all-time task log. */
export const getCompletedSpins = () =>
  prisma.wheelSpins.findMany({ where: { status: SPIN_STATUS.COMPLETED } });

/** Tasks members are out on right now (callers filter to the live instance). */
export const getActiveSpins = () =>
  prisma.wheelSpins.findMany({ where: { status: SPIN_STATUS.ACTIVE } });

/** Every spin one member has ever been assigned, completed or not. */
export const getSpinsForDiscordId = (discordId: string) =>
  prisma.wheelSpins.findMany({ where: { discordId } });

/** How many tasks have been handed out in total, by what became of them. */
export const getSpinCountsByStatus = async (): Promise<
  Record<string, number>
> => {
  const rows = await prisma.wheelSpins.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map(row => [row.status, row._count._all]));
};
