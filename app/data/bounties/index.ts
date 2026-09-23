import { prisma } from '~/utils/db.server';

// Clan bounty rows, written by the Discord bot. One document per bounty; the winners are
// embedded as an append-only claims array whose order is the finishing order.

export const BOUNTY_STATUS = {
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

/** Every bounty ever posted, newest first. */
export const getBounties = () =>
  prisma.bounties.findMany({ orderBy: { postedAt: 'desc' } });

/** The bounties one member has a claim on, newest first. */
export const getBountiesForDiscordId = (discordId: string) =>
  prisma.bounties.findMany({
    where: { claims: { some: { discordId } } },
    orderBy: { postedAt: 'desc' },
  });
