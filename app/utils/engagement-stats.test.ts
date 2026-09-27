import { describe, expect, it } from 'vitest';
import type { IEngagementEvent } from './engagement';
import {
  activationFunnel,
  adjustedLiftPercent,
  clanSystemActiveByMonth,
  ehbDistribution,
  firstActionByMember,
  retentionByJoinAge,
  slayerFunnel,
  median,
  monthlyFlows,
  share,
  summarizeReach,
  summarizeTenure,
} from './engagement-stats';

const now = new Date('2026-09-27T12:00:00.000Z');
const event = (
  system: IEngagementEvent['system'],
  discordId: string,
  at: string,
): IEngagementEvent => ({ system, discordId, at });

describe('median and share', () => {
  it('handles odd, even, and empty lists', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('rounds shares and has no value without a denominator', () => {
    expect(share(1, 3)).toBe(33);
    expect(share(0, 0)).toBeNull();
  });
});

describe('summarizeReach', () => {
  const start = '2026-09-01T00:00:00.000Z';
  const end = '2026-10-01T00:00:00.000Z';
  const events = [
    // Slayer: a and b this month; a, b, c last month -> 2 of 3 came back.
    event('slayer', 'a', '2026-09-05T00:00:00.000Z'),
    event('slayer', 'b', '2026-09-06T00:00:00.000Z'),
    event('slayer', 'a', '2026-08-05T00:00:00.000Z'),
    event('slayer', 'b', '2026-08-06T00:00:00.000Z'),
    event('slayer', 'c', '2026-08-07T00:00:00.000Z'),
    // Drops: only d, who was not active in-game.
    event('drops', 'd', '2026-09-10T00:00:00.000Z'),
  ];

  it('measures reach against in-game-active members and repeat against last window', () => {
    const active = new Set(['a', 'b', 'c', 'e']);
    const reach = summarizeReach(events, start, end, active);
    expect(reach.find(row => row.system === 'slayer')).toEqual({
      system: 'slayer',
      users: 2,
      reach: 50,
      previousUsers: 3,
      repeat: 67,
      passive: false,
    });
    expect(reach.find(row => row.system === 'drops')).toMatchObject({
      users: 1,
      reach: 0,
      previousUsers: 0,
      repeat: null,
      passive: true,
    });
  });

  it('has no reach without anyone active', () => {
    const reach = summarizeReach(events, start, end, new Set());
    expect(reach.find(row => row.system === 'slayer')?.reach).toBeNull();
  });
});

describe('summarizeTenure', () => {
  it('splits by join date and reports rates and medians per cohort', () => {
    const member = (
      discordId: string,
      joined: string,
      activeInGame: boolean,
      usedAnySystem: boolean,
      ehbGained: number,
    ) => ({ discordId, joined, activeInGame, usedAnySystem, ehbGained });
    const cohorts = summarizeTenure(
      [
        member('n1', '2026-09-01T00:00:00.000Z', true, true, 10),
        member('n2', '2026-08-15T00:00:00.000Z', true, false, 2),
        member('s1', '2026-03-01T00:00:00.000Z', false, false, 0),
        member('s2', '2026-01-01T00:00:00.000Z', true, true, 6),
        member('v1', '2024-01-01T00:00:00.000Z', false, false, 0),
      ],
      now,
      1.5,
    );
    expect(cohorts.map(cohort => cohort.members)).toEqual([2, 2, 1]);
    expect(cohorts[0]).toMatchObject({
      key: 'new',
      activeShare: 100,
      usedSystemShare: 50,
      medianEhbActive: 6,
      aboveFloorShare: 100,
    });
    expect(cohorts[1]).toMatchObject({
      key: 'settled',
      activeShare: 50,
      medianEhbActive: 6,
      aboveFloorShare: 100,
    });
    expect(cohorts[2]).toMatchObject({
      key: 'veteran',
      activeShare: 0,
      medianEhbActive: 0,
      aboveFloorShare: null,
    });
  });
});

describe('monthlyFlows', () => {
  it('counts churn and reactivation against the previous month', () => {
    const flows = monthlyFlows(
      [
        { month: '2026-07', label: 'Jul 2026', activeIds: new Set(['a', 'b']) },
        { month: '2026-08', label: 'Aug 2026', activeIds: new Set(['b', 'c']) },
        { month: '2026-09', label: 'Sep 2026', activeIds: new Set(['c']) },
      ],
      4,
    );
    expect(flows[0]).toMatchObject({
      active: 2,
      activeShare: 50,
      churned: null,
      reactivated: null,
      churnRate: null,
    });
    expect(flows[1]).toMatchObject({
      active: 2,
      churned: 1,
      reactivated: 1,
      churnRate: 50,
    });
    expect(flows[2]).toMatchObject({
      active: 1,
      activeShare: 25,
      churned: 1,
      reactivated: 0,
      churnRate: 50,
    });
  });
});

describe('clanSystemActiveByMonth', () => {
  it('builds one active set per UTC month, oldest first', () => {
    const months = clanSystemActiveByMonth(
      [
        event('drops', 'a', '2026-08-31T23:59:59.000Z'),
        event('drops', 'b', '2026-09-01T00:00:00.000Z'),
        event('raids', 'b', '2026-09-15T00:00:00.000Z'),
      ],
      2,
      now,
    );
    expect(months.map(month => month.month)).toEqual(['2026-08', '2026-09']);
    expect([...months[0].activeIds]).toEqual(['a']);
    expect([...months[1].activeIds]).toEqual(['b']);
  });
});

describe('adjustedLiftPercent', () => {
  it('removes the overall PvM movement from the lift', () => {
    // Participants doubled while all PvM also doubled: no real lift.
    expect(adjustedLiftPercent(10, 5, 200, 100)).toBe(0);
    // Participants doubled while PvM was flat: +100%.
    expect(adjustedLiftPercent(10, 5, 100, 100)).toBe(100);
    // Participants up 50% while PvM fell 25%: (1.5 / 0.75) - 1 = +100%.
    expect(adjustedLiftPercent(6, 4, 75, 100)).toBe(100);
  });

  it('has no value without both baselines', () => {
    expect(adjustedLiftPercent(3, 0, 100, 100)).toBeNull();
    expect(adjustedLiftPercent(3, 2, 100, 0)).toBeNull();
  });
});

describe('retentionByJoinAge', () => {
  it('buckets joiners by age and reports who stayed and who plays', () => {
    const member = (
      discordId: string,
      joined: string,
      onRoster: boolean,
      activeInGame: boolean,
    ) => ({ discordId, joined, onRoster, activeInGame });
    const buckets = retentionByJoinAge(
      [
        member('a', '2026-09-01T00:00:00.000Z', true, true),
        member('b', '2026-08-15T00:00:00.000Z', false, false),
        member('c', '2026-05-01T00:00:00.000Z', true, false),
        member('d', '2024-01-01T00:00:00.000Z', true, true),
      ],
      now,
    );
    expect(buckets.map(bucket => bucket.joined)).toEqual([2, 1, 0, 0, 1]);
    expect(buckets[0]).toMatchObject({ retained: 50, active: 50 });
    expect(buckets[1]).toMatchObject({ retained: 100, active: 0 });
    expect(buckets[2]).toMatchObject({ retained: null, active: null });
    expect(buckets[4]).toMatchObject({ retained: 100, active: 100 });
  });
});

describe('activationFunnel and firstActionByMember', () => {
  it('measures days from join to first action, ignoring actions before the join', () => {
    const first = firstActionByMember([
      event('drops', 'a', '2026-09-10T00:00:00.000Z'),
      event('drops', 'a', '2026-09-03T00:00:00.000Z'),
      event('raids', 'b', '2026-09-20T00:00:00.000Z'),
      event('drops', 'd', '2026-08-01T00:00:00.000Z'),
    ]);
    expect(first.get('a')).toBe('2026-09-03T00:00:00.000Z');
    const funnel = activationFunnel(
      [
        { discordId: 'a', joined: '2026-09-01T00:00:00.000Z' },
        { discordId: 'b', joined: '2026-09-01T00:00:00.000Z' },
        { discordId: 'c', joined: '2026-09-01T00:00:00.000Z' },
        { discordId: 'd', joined: '2026-09-01T00:00:00.000Z' },
      ],
      first,
    );
    expect(funnel).toEqual({
      joined: 4,
      within7Days: 1,
      within30Days: 2,
      ever: 2,
      medianDaysToFirstAction: 10.5,
    });
  });
});

describe('ehbDistribution', () => {
  it('counts members per bucket and reports the median', () => {
    const distribution = ehbDistribution([5, 150, 150, 400, 900, 2000]);
    expect(distribution.buckets.map(bucket => bucket.members)).toEqual([
      1, 2, 1, 1, 1,
    ]);
    expect(distribution.members).toBe(6);
    expect(distribution.median).toBe(275);
  });
});

describe('slayerFunnel', () => {
  it('reports completion rate and spins per completion', () => {
    const funnel = slayerFunnel([
      { status: 'COMPLETED', spinType: 'INITIAL' },
      { status: 'REPLACED', spinType: 'INITIAL' },
      { status: 'REPLACED', spinType: 'REROLL' },
      { status: 'ACTIVE', spinType: 'REROLL' },
    ]);
    expect(funnel).toEqual({
      spins: 4,
      initialSpins: 2,
      completed: 1,
      replaced: 2,
      completionRate: 25,
      spinsPerCompletion: 4,
    });
    expect(slayerFunnel([]).spinsPerCompletion).toBeNull();
  });
});
