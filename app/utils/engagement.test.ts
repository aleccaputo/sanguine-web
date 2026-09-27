import { describe, expect, it } from 'vitest';
import {
  bountyMeasurementWindow,
  IEngagementEvent,
  monthlyEngagementSeries,
  scoreBounty,
  summarizeEngagement,
  summarizePvmActivity,
} from './engagement';

const now = new Date('2026-09-27T12:00:00.000Z');

describe('bountyMeasurementWindow', () => {
  it('pads a closed bounty by one update interval on each side and mirrors it as the baseline', () => {
    const window = bountyMeasurementWindow(
      {
        postedAt: '2026-09-10T18:00:00.000Z',
        closedAt: '2026-09-11T06:00:00.000Z',
      },
      now,
    );
    expect(window).toEqual({
      start: '2026-09-09T18:00:00.000Z',
      end: '2026-09-12T06:00:00.000Z',
      baselineStart: '2026-09-07T06:00:00.000Z',
      baselineEnd: '2026-09-09T18:00:00.000Z',
      settled: true,
    });
  });

  it('runs an open bounty up to now and leaves it unsettled', () => {
    const window = bountyMeasurementWindow(
      { postedAt: '2026-09-26T00:00:00.000Z', closedAt: null },
      now,
    );
    expect(window.start).toBe('2026-09-25T00:00:00.000Z');
    expect(window.end).toBe(now.toISOString());
    expect(window.settled).toBe(false);
  });

  it('caps a just-closed bounty at now until the next update lands', () => {
    const window = bountyMeasurementWindow(
      {
        postedAt: '2026-09-26T00:00:00.000Z',
        closedAt: '2026-09-27T06:00:00.000Z',
      },
      now,
    );
    expect(window.end).toBe(now.toISOString());
    expect(window.settled).toBe(false);
  });
});

describe('scoreBounty', () => {
  const gains = (rows: [string, number][]) =>
    rows.map(([displayName, gained]) => ({ displayName, gained }));

  it('counts gainers on each side and reports the lift between them', () => {
    const card = scoreBounty({
      during: gains([
        ['Alice', 40],
        ['Bob', 12],
        ['Cara', 0],
        ['Dan', 3],
      ]),
      before: gains([
        ['Alice', 20],
        ['Cara', 0],
      ]),
      claimCount: 2,
      postedAt: '2026-09-10T18:00:00.000Z',
      closedAt: '2026-09-11T06:30:00.000Z',
      status: 'CLAIMED',
    });
    expect(card).toMatchObject({
      participants: 3,
      baselineParticipants: 1,
      lift: 2,
      liftPercent: 200,
      killsDuring: 55,
      killsBefore: 20,
      claimCount: 2,
      hoursOpen: 13,
    });
    expect(card.topParticipants.map(row => row.displayName)).toEqual([
      'Alice',
      'Bob',
      'Dan',
    ]);
  });

  it('has no percent lift without a baseline and no hours while open', () => {
    const card = scoreBounty({
      during: gains([['Alice', 1]]),
      before: [],
      claimCount: 0,
      postedAt: '2026-09-26T00:00:00.000Z',
      closedAt: null,
      status: 'OPEN',
    });
    expect(card.liftPercent).toBeNull();
    expect(card.hoursOpen).toBeNull();
    expect(card.lift).toBe(1);
  });

  it('caps the top participants list', () => {
    const card = scoreBounty(
      {
        during: gains([
          ['A', 1],
          ['B', 2],
          ['C', 3],
        ]),
        before: [],
        claimCount: 0,
        postedAt: '2026-09-26T00:00:00.000Z',
        closedAt: null,
        status: 'OPEN',
      },
      2,
    );
    expect(card.topParticipants).toEqual([
      { displayName: 'C', gained: 3 },
      { displayName: 'B', gained: 2 },
    ]);
  });
});

const event = (
  system: IEngagementEvent['system'],
  discordId: string,
  at: string,
): IEngagementEvent => ({ system, discordId, at });

const events: IEngagementEvent[] = [
  event('drops', '1', '2026-09-01T00:00:00.000Z'),
  event('drops', '1', '2026-09-02T00:00:00.000Z'),
  event('slayer', '1', '2026-09-03T00:00:00.000Z'),
  event('drops', '2', '2026-09-05T00:00:00.000Z'),
  event('bounties', '3', '2026-08-20T00:00:00.000Z'),
  event('raids', '2', '2026-07-15T00:00:00.000Z'),
];

describe('summarizeEngagement', () => {
  it('counts distinct members per system and ranks members by breadth then volume', () => {
    const summary = summarizeEngagement(
      events,
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    );
    expect(summary.activeMembers).toBe(2);
    expect(summary.bySystem.find(row => row.system === 'drops')).toEqual({
      system: 'drops',
      members: 2,
      events: 3,
    });
    expect(summary.bySystem.find(row => row.system === 'bounties')).toEqual({
      system: 'bounties',
      members: 0,
      events: 0,
    });
    expect(summary.byMember).toEqual([
      { discordId: '1', systems: ['drops', 'slayer'], events: 3 },
      { discordId: '2', systems: ['drops'], events: 1 },
    ]);
  });

  it('treats the end of the window as exclusive', () => {
    const summary = summarizeEngagement(
      events,
      '2026-08-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
    );
    expect(summary.byMember.map(row => row.discordId)).toEqual(['3']);
  });
});

describe('monthlyEngagementSeries', () => {
  it('produces one UTC calendar month per entry, oldest first, ending on the current month', () => {
    const series = monthlyEngagementSeries(events, 3, now);
    expect(series.map(row => row.month)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(series.map(row => row.label)).toEqual([
      'Jul 2026',
      'Aug 2026',
      'Sep 2026',
    ]);
    expect(series.map(row => row.activeMembers)).toEqual([1, 1, 2]);
    expect(series[0].members.raids).toBe(1);
    expect(series[2].members.drops).toBe(2);
  });

  it('crosses a year boundary', () => {
    const series = monthlyEngagementSeries(
      [],
      3,
      new Date('2026-01-15T00:00:00.000Z'),
    );
    expect(series.map(row => row.month)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});

describe('summarizePvmActivity', () => {
  it('ignores members who did not move and ranks the rest', () => {
    const activity = summarizePvmActivity([
      { displayName: 'A', gained: 0 },
      { displayName: 'B', gained: 5.5 },
      { displayName: 'C', gained: 12 },
    ]);
    expect(activity).toEqual({
      activeMembers: 2,
      totalGained: 17.5,
      top: [
        { displayName: 'C', gained: 12 },
        { displayName: 'B', gained: 5.5 },
      ],
    });
  });
});
