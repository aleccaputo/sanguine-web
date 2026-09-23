import { describe, expect, it } from 'vitest';
import {
  BOUNTY_STATUS,
  describeBountyState,
  ordinal,
  slotsRemaining,
} from './bounty';

const base = {
  maxWinners: 3,
  claimCount: 1,
  expiresAt: null,
  closedAt: null,
};

describe('slotsRemaining', () => {
  it('counts open slots while OPEN and reports none once closed', () => {
    expect(slotsRemaining({ ...base, status: BOUNTY_STATUS.OPEN })).toBe(2);
    expect(
      slotsRemaining({ ...base, status: BOUNTY_STATUS.OPEN, claimCount: 5 }),
    ).toBe(0);
    expect(slotsRemaining({ ...base, status: BOUNTY_STATUS.EXPIRED })).toBe(0);
  });
});

describe('describeBountyState', () => {
  it('distinguishes deadline bounties from open-ended ones', () => {
    expect(
      describeBountyState({ ...base, status: BOUNTY_STATUS.OPEN }),
    ).toEqual({ label: 'Open until claimed', dateKey: null });
    expect(
      describeBountyState({
        ...base,
        status: BOUNTY_STATUS.OPEN,
        expiresAt: '2026-09-24T00:00:00.000Z',
      }),
    ).toEqual({ label: 'Ends', dateKey: 'expiresAt' });
  });

  it('labels every closed state and calls out an unclaimed expiry', () => {
    expect(
      describeBountyState({ ...base, status: BOUNTY_STATUS.CLAIMED }).label,
    ).toBe('Claimed');
    expect(
      describeBountyState({ ...base, status: BOUNTY_STATUS.EXPIRED }).label,
    ).toBe('Ended');
    expect(
      describeBountyState({
        ...base,
        status: BOUNTY_STATUS.EXPIRED,
        claimCount: 0,
      }).label,
    ).toBe('Ended unclaimed');
    expect(
      describeBountyState({ ...base, status: BOUNTY_STATUS.CANCELLED }),
    ).toEqual({ label: 'Cancelled', dateKey: 'closedAt' });
  });
});

describe('ordinal', () => {
  it('handles the English edge cases', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      [
        '1st',
        '2nd',
        '3rd',
        '4th',
        '11th',
        '12th',
        '13th',
        '21st',
        '22nd',
        '23rd',
        '101st',
        '111th',
      ],
    );
  });
});
