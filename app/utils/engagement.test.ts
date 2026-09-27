import { describe, expect, it } from 'vitest';
import {
  bountyMeasurementWindow,
  IEngagementEvent,
  lastEventAtByMember,
  monthlyEngagementSeries,
  scoreBounty,
  summarizeInactivity,
  summarizeInGameSplit,
  summarizeSkillingOnly,
  pvmFloorForDays,
  sumGainsByPlayer,
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
      { displayName: 'C', gained: 3, discordId: null },
      { displayName: 'B', gained: 2, discordId: null },
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
      { displayName: 'C', gained: 12, discordId: 'c' },
    ]);
    expect(activity).toEqual({
      activeMembers: 2,
      totalGained: 17.5,
      top: [
        { displayName: 'C', gained: 12, discordId: 'c' },
        { displayName: 'B', gained: 5.5, discordId: null },
      ],
    });
  });
});

describe('lastEventAtByMember', () => {
  it('keeps the latest timestamp per member', () => {
    const latest = lastEventAtByMember(events);
    expect(latest.get('1')).toBe('2026-09-03T00:00:00.000Z');
    expect(latest.get('2')).toBe('2026-09-05T00:00:00.000Z');
    expect(latest.get('9')).toBeUndefined();
  });
});

describe('summarizeInactivity', () => {
  const start = '2026-08-28T12:00:00.000Z';
  const member = (
    discordId: string,
    lastClanEventAt: string | null,
    lastInGameChangeAt: string | null,
  ) => ({
    discordId,
    joined: '2025-01-01T00:00:00.000Z',
    lastClanEventAt,
    lastInGameChangeAt,
    activeAlt: null,
    womRole: 'member',
  });

  it('leaves members with an event in the window out entirely', () => {
    const summary = summarizeInactivity(
      [member('active', '2026-09-10T00:00:00.000Z', null)],
      start,
      now,
    );
    expect(summary).toEqual({
      playingNotParticipating: [],
      goneQuiet: [],
      notOnWom: [],
    });
  });

  it('splits idle members by in-game activity and sorts each list usefully', () => {
    const summary = summarizeInactivity(
      [
        member(
          'playing-recent',
          '2026-06-01T00:00:00.000Z',
          '2026-09-26T00:00:00.000Z',
        ),
        member('playing-older', null, '2026-09-01T00:00:00.000Z'),
        member(
          'quiet-long',
          '2026-03-01T00:00:00.000Z',
          '2026-04-01T00:00:00.000Z',
        ),
        member(
          'quiet-short',
          '2026-08-01T00:00:00.000Z',
          '2026-08-20T00:00:00.000Z',
        ),
        member('no-wom', null, null),
      ],
      start,
      now,
    );
    expect(summary.playingNotParticipating.map(row => row.discordId)).toEqual([
      'playing-recent',
      'playing-older',
    ]);
    expect(summary.goneQuiet.map(row => row.discordId)).toEqual([
      'quiet-long',
      'quiet-short',
    ]);
    expect(summary.notOnWom.map(row => row.discordId)).toEqual(['no-wom']);
    expect(summary.playingNotParticipating[0]).toMatchObject({
      daysSinceClanEvent: 118,
      daysSinceInGameChange: 1,
    });
    expect(summary.notOnWom[0]).toMatchObject({
      daysSinceClanEvent: null,
      daysSinceInGameChange: null,
    });
  });
});

describe('sumGainsByPlayer', () => {
  it('adds gains per player across metrics, keeping players missing from some lists', () => {
    const rows = sumGainsByPlayer([
      [
        { username: 'a', displayName: 'A', gained: 3 },
        { username: 'b', displayName: 'B', gained: 1 },
      ],
      [{ username: 'a', displayName: 'A', gained: 4 }],
      [],
    ]);
    expect(rows).toEqual([
      { username: 'a', displayName: 'A', gained: 7 },
      { username: 'b', displayName: 'B', gained: 1 },
    ]);
  });
});

describe('summarizeSkillingOnly', () => {
  const start = '2026-08-28T12:00:00.000Z';
  const member = (
    discordId: string,
    lastInGameChangeAt: string | null,
    ehbGained: number,
    ehpGained: number,
  ) => ({
    discordId,
    womRole: 'member',
    lastInGameChangeAt,
    activeAlt: null,
    ehbGained,
    ehpGained,
  });

  it('keeps in-game-active members under the PvM floor, most skilling first', () => {
    const rows = summarizeSkillingOnly(
      [
        member('skiller', '2026-09-20T00:00:00.000Z', 0.4, 12.5),
        member('big-skiller', '2026-09-25T00:00:00.000Z', 0, 30),
        member('pvmer', '2026-09-20T00:00:00.000Z', 9, 2),
        member('gone', '2026-07-01T00:00:00.000Z', 0, 0),
        member('no-wom', null, 0, 0),
      ],
      start,
      now,
      pvmFloorForDays(30),
    );
    expect(rows.map(row => row.discordId)).toEqual(['big-skiller', 'skiller']);
    expect(rows[0].daysSinceInGameChange).toBe(2);
  });

  it('scales the floor with the window', () => {
    expect(pvmFloorForDays(30)).toBe(1.5);
    expect(pvmFloorForDays(7)).toBe(0.35);
  });
});

describe('summarizeInGameSplit', () => {
  it('buckets members by what they gained, leaving unknowns out of the drawn total', () => {
    const member = (
      discordId: string,
      lastInGameChangeAt: string | null,
      ehbGained: number,
      ehpGained: number,
    ) => ({
      discordId,
      womRole: 'member',
      lastInGameChangeAt,
      activeAlt: null,
      ehbGained,
      ehpGained,
    });
    expect(
      summarizeInGameSplit(
        [
          member('pvm', '2026-09-20T00:00:00.000Z', 3, 1),
          member('skill', '2026-09-20T00:00:00.000Z', 0, 8),
          member('light', '2026-09-20T00:00:00.000Z', 0.5, 0),
          member('idle', '2026-01-01T00:00:00.000Z', 0, 0),
          member('nowom', null, 0, 0),
        ],
        1.5,
      ),
    ).toEqual({ pvming: 1, skilling: 2, noGains: 1, unknown: 1 });
  });
});
