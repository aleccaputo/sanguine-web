import { SLAYER_ICON } from '~/utils/slayer';

/** Bounties are posted by the same Slayer Master, so they share the page icon. */
export const BOUNTY_ICON = SLAYER_ICON;

/** Bounty statuses, mirroring the bot's BountyStatus enum. */
export const BOUNTY_STATUS = {
  /** Accepting claims until every winner slot is filled or the deadline passes. */
  OPEN: 'OPEN',
  /** Every winner slot was claimed. */
  CLAIMED: 'CLAIMED',
  /** The deadline passed with at least one slot still open. */
  EXPIRED: 'EXPIRED',
  /** Pulled by an admin; claims already paid stand. */
  CANCELLED: 'CANCELLED',
} as const;

export type BountyStatus = (typeof BOUNTY_STATUS)[keyof typeof BOUNTY_STATUS];

interface IBountyLike {
  status: string;
  maxWinners: number;
  claimCount: number;
  expiresAt: string | null;
  closedAt: string | null;
}

/** Winner slots still open. Zero once the bounty has closed for any reason. */
export const slotsRemaining = ({
  status,
  maxWinners,
  claimCount,
}: Pick<IBountyLike, 'status' | 'maxWinners' | 'claimCount'>): number =>
  status === BOUNTY_STATUS.OPEN ? Math.max(0, maxWinners - claimCount) : 0;

/**
 * The one-line state a list row shows, in the same words the Discord card uses.
 * Dates are left to the caller (they format per locale); this returns the label
 * and, where a date belongs after it, which date.
 */
export const describeBountyState = (
  bounty: IBountyLike,
): { label: string; dateKey: 'expiresAt' | 'closedAt' | null } => {
  switch (bounty.status) {
    case BOUNTY_STATUS.OPEN:
      return bounty.expiresAt
        ? { label: 'Ends', dateKey: 'expiresAt' }
        : { label: 'Open until claimed', dateKey: null };
    case BOUNTY_STATUS.CLAIMED:
      return { label: 'Claimed', dateKey: 'closedAt' };
    case BOUNTY_STATUS.EXPIRED:
      return bounty.claimCount === 0
        ? { label: 'Ended unclaimed', dateKey: 'closedAt' }
        : { label: 'Ended', dateKey: 'closedAt' };
    default:
      return { label: 'Cancelled', dateKey: 'closedAt' };
  }
};

/** 1st / 2nd / 3rd / 4th / 11th / 21st. */
export const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};
