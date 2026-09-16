import type { ITileRaceHistoryEntry } from '~/services/tile-race-service.server';
import type { IApprovedDrop } from '~/services/events-admin-service.server';

/**
 * Pure aggregation for the tile race stats page: every approved submission is
 * one drop, and the page counts them by member, team, and task.
 */

/** One approved drop as the page renders it (nicknames resolved server-side). */
export interface IRaceDrop {
  teamId: string;
  tileIndex: number;
  tier: number | null;
  /** Submitter's Discord id; null when the API stripped it (public payload) */
  memberId: string | null;
  /** Submitter's clan nickname; null when unknown or not in the clan records */
  memberName: string | null;
  note: string | null;
  approvedAt: string | null;
}

/** A drop straight off the API, before nicknames are resolved. */
export interface IRawRaceDrop {
  tileIndex: number;
  tier: number | null;
  submittedByDiscordId: string | null;
  note: string | null;
  approvedAt: string | null;
}

interface IStandingDropsSource {
  approvedDrops?: IApprovedDrop[];
  history?: ITileRaceHistoryEntry[];
}

/**
 * A team's approved drops. Prefers the admin payload's per-submission list;
 * older API deploys (and the public payload) only carry one closing submission
 * per cleared tile in `history`, so that stands in — undercounting counted tiles.
 */
export const dropsForStanding = (
  standing: IStandingDropsSource,
): IRawRaceDrop[] =>
  standing.approvedDrops
    ? standing.approvedDrops.map(drop => ({
        tileIndex: drop.tileIndex,
        tier: drop.tier,
        submittedByDiscordId: drop.submittedByDiscordId,
        note: drop.note,
        approvedAt: drop.approvedAt,
      }))
    : (standing.history ?? [])
        .filter(entry => !entry.isFinish)
        .map(entry => ({
          tileIndex: entry.tileIndex,
          tier: entry.tier,
          submittedByDiscordId: entry.submittedByDiscordId ?? null,
          note: entry.note,
          approvedAt: entry.completedAt,
        }));

export interface IMemberDropTally {
  /** Discord id, or 'unknown' for drops whose submitter isn't known */
  key: string;
  memberId: string | null;
  memberName: string | null;
  teamId: string;
  drops: number;
  latestAt: string | null;
}

export const UNKNOWN_MEMBER_KEY = 'unknown';

const laterOf = (a: string | null, b: string | null): string | null =>
  a && b ? (a.localeCompare(b) >= 0 ? a : b) : a ?? b;

/** Drops per submitter, most drops first (ties alphabetical). */
export const tallyDropsByMember = (drops: IRaceDrop[]): IMemberDropTally[] =>
  Object.values(
    drops.reduce<Record<string, IMemberDropTally>>((acc, drop) => {
      const key = drop.memberId ?? UNKNOWN_MEMBER_KEY;
      const prev = acc[key];
      return {
        ...acc,
        [key]: prev
          ? {
              ...prev,
              drops: prev.drops + 1,
              latestAt: laterOf(prev.latestAt, drop.approvedAt),
            }
          : {
              key,
              memberId: drop.memberId,
              memberName: drop.memberName,
              teamId: drop.teamId,
              drops: 1,
              latestAt: drop.approvedAt,
            },
      };
    }, {}),
  ).sort(
    (a, b) =>
      b.drops - a.drops ||
      (a.memberName ?? '').localeCompare(b.memberName ?? ''),
  );

/** Drop count per team id (teams with none are absent). */
export const tallyDropsByTeam = (drops: IRaceDrop[]): Record<string, number> =>
  drops.reduce<Record<string, number>>(
    (acc, drop) => ({ ...acc, [drop.teamId]: (acc[drop.teamId] ?? 0) + 1 }),
    {},
  );

/** Drops per tile index, each list oldest approval first. */
export const groupDropsByTile = (
  drops: IRaceDrop[],
): Record<number, IRaceDrop[]> =>
  [...drops]
    .sort((a, b) => (a.approvedAt ?? '').localeCompare(b.approvedAt ?? ''))
    .reduce<Record<number, IRaceDrop[]>>(
      (acc, drop) => ({
        ...acc,
        [drop.tileIndex]: [...(acc[drop.tileIndex] ?? []), drop],
      }),
      {},
    );

/** Distinct values in first-seen order, nulls dropped. */
export const distinct = <T>(values: (T | null | undefined)[]): T[] =>
  values.filter(
    (value, i, all): value is T => value != null && all.indexOf(value) === i,
  );
