import { describe, expect, it } from 'vitest';
import {
  distinct,
  dropsForStanding,
  groupDropsByTile,
  IRaceDrop,
  tallyDropsByMember,
  tallyDropsByTeam,
} from './tile-race-stats';

const drop = (overrides: Partial<IRaceDrop> = {}): IRaceDrop => ({
  teamId: 'team-1',
  tileIndex: 3,
  tier: 1,
  memberId: 'u1',
  memberName: 'Alice',
  note: null,
  approvedAt: '2026-08-02T18:00:00.000Z',
  ...overrides,
});

describe('dropsForStanding', () => {
  it('prefers the per-submission list so counted tiles count every drop', () => {
    const drops = dropsForStanding({
      approvedDrops: [
        {
          tileIndex: 4,
          tier: 1,
          submittedByDiscordId: 'u1',
          note: 'head 1',
          submittedAt: '2026-08-02T17:00:00.000Z',
          approvedAt: '2026-08-02T18:00:00.000Z',
        },
        {
          tileIndex: 4,
          tier: 1,
          submittedByDiscordId: 'u2',
          note: null,
          submittedAt: '2026-08-03T17:00:00.000Z',
          approvedAt: '2026-08-03T18:00:00.000Z',
        },
      ],
      history: [
        {
          tileIndex: 4,
          tier: 1,
          isFinish: false,
          rollValue: null,
          note: 'head 1',
          completedAt: '2026-08-03T18:00:00.000Z',
          submittedByDiscordId: 'u2',
        },
      ],
    });

    expect(drops.map(d => d.submittedByDiscordId)).toEqual(['u1', 'u2']);
  });

  it('falls back to one drop per cleared tile from history, skipping the finish crossing', () => {
    const drops = dropsForStanding({
      history: [
        {
          tileIndex: 2,
          tier: 1,
          isFinish: false,
          rollValue: null,
          note: 'Bandos hilt',
          completedAt: '2026-08-02T18:00:00.000Z',
        },
        {
          tileIndex: 9,
          tier: null,
          isFinish: true,
          rollValue: null,
          note: null,
          completedAt: '2026-08-10T18:00:00.000Z',
        },
      ],
    });

    expect(drops).toEqual([
      {
        tileIndex: 2,
        tier: 1,
        submittedByDiscordId: null,
        note: 'Bandos hilt',
        approvedAt: '2026-08-02T18:00:00.000Z',
      },
    ]);
  });
});

describe('tallyDropsByMember', () => {
  it('counts drops per submitter, most first, keeping the latest approval date', () => {
    const tally = tallyDropsByMember([
      drop({ memberId: 'u1', memberName: 'Alice' }),
      drop({
        memberId: 'u2',
        memberName: 'Bob',
        approvedAt: '2026-08-05T18:00:00.000Z',
      }),
      drop({
        memberId: 'u2',
        memberName: 'Bob',
        approvedAt: '2026-08-04T18:00:00.000Z',
      }),
    ]);

    expect(tally.map(t => [t.memberName, t.drops, t.latestAt])).toEqual([
      ['Bob', 2, '2026-08-05T18:00:00.000Z'],
      ['Alice', 1, '2026-08-02T18:00:00.000Z'],
    ]);
  });

  it('pools drops with no known submitter into one unknown row', () => {
    const tally = tallyDropsByMember([
      drop({ memberId: null, memberName: null }),
      drop({ memberId: null, memberName: null }),
    ]);

    expect(tally).toHaveLength(1);
    expect(tally[0].key).toBe('unknown');
    expect(tally[0].drops).toBe(2);
  });
});

describe('tallyDropsByTeam and groupDropsByTile', () => {
  it('counts per team and groups per tile oldest first', () => {
    const drops = [
      drop({ teamId: 'a', tileIndex: 1, approvedAt: '2026-08-03T00:00:00Z' }),
      drop({ teamId: 'b', tileIndex: 1, approvedAt: '2026-08-01T00:00:00Z' }),
      drop({ teamId: 'a', tileIndex: 2 }),
    ];

    expect(tallyDropsByTeam(drops)).toEqual({ a: 2, b: 1 });
    expect(groupDropsByTile(drops)[1].map(d => d.teamId)).toEqual(['b', 'a']);
    expect(groupDropsByTile(drops)[2]).toHaveLength(1);
  });
});

describe('distinct', () => {
  it('keeps first occurrences and drops nulls', () => {
    expect(distinct(['a', null, 'b', 'a', undefined])).toEqual(['a', 'b']);
  });
});
