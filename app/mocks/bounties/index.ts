import { MOCK_BOUNTIES } from '~/mocks/fixtures.server';

export const BOUNTY_STATUS = {
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

const newestFirst = <T extends { postedAt: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

export const getBounties = async () => newestFirst(MOCK_BOUNTIES);

export const getBountiesForDiscordId = async (discordId: string) =>
  newestFirst(
    MOCK_BOUNTIES.filter(bounty =>
      bounty.claims.some(claim => claim.discordId === discordId),
    ),
  );

export const getBountyById = async (id: string) =>
  MOCK_BOUNTIES.find(bounty => bounty.id === id) ?? null;
