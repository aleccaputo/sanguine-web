import {
  ENGAGEMENT_SYSTEMS,
  EngagementSystem,
  IEngagementEvent,
} from '~/utils/engagement';

// The statistics the insights page uses to drive decisions, kept pure so every number has a
// stated denominator and a unit test. Rates over totals, medians over means, cohorts over single
// points: totals reward a few heavy users and means follow them.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Middle value, or 0 for an empty list. */
export const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0
    ? 0
    : sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Whole-number percent of part over whole, or null when the whole is 0 (no denominator). */
export const share = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 100);

const distinctMembers = (events: IEngagementEvent[]): Set<string> =>
  new Set(events.map(event => event.discordId));

const between = (events: IEngagementEvent[], start: string, end: string) =>
  events.filter(event => event.at >= start && event.at < end);

// ---- Reach and repeat ----

/** Systems whose actions happen as a side effect of playing (auto-posted), not by choosing to. */
export const PASSIVE_SYSTEMS: readonly EngagementSystem[] = ['drops'];

export interface ISystemReach {
  system: EngagementSystem;
  /** Distinct members who used the system in the window. */
  users: number;
  /** Percent of in-game-active members who used it, or null when nobody was active. */
  reach: number | null;
  /** Distinct users in the equal-length window before. */
  previousUsers: number;
  /** Percent of last window's users who used it again this window, or null when none did before. */
  repeat: number | null;
  passive: boolean;
}

/**
 * For each system: reach among members who were active in-game (the members who could have
 * used it), and the share of last window's users who came back. Reach compares systems fairly
 * because it ignores how much each heavy user does; repeat shows whether a system is sticking
 * or was a novelty.
 */
export const summarizeReach = (
  events: IEngagementEvent[],
  start: string,
  end: string,
  activeInGame: Set<string>,
): ISystemReach[] => {
  const length = new Date(end).getTime() - new Date(start).getTime();
  const previousStart = new Date(
    new Date(start).getTime() - length,
  ).toISOString();
  return ENGAGEMENT_SYSTEMS.map(system => {
    const own = events.filter(event => event.system === system);
    const users = distinctMembers(between(own, start, end));
    const previous = distinctMembers(between(own, previousStart, start));
    const returning = [...previous].filter(id => users.has(id)).length;
    const usersActive = [...users].filter(id => activeInGame.has(id)).length;
    return {
      system,
      users: users.size,
      reach: share(usersActive, activeInGame.size),
      previousUsers: previous.size,
      repeat: share(returning, previous.size),
      passive: PASSIVE_SYSTEMS.includes(system),
    };
  });
};

// ---- Tenure cohorts ----

export interface ITenureMember {
  discordId: string;
  joined: string;
  activeInGame: boolean;
  usedAnySystem: boolean;
  /** EHB gained this window across the member's accounts. */
  ehbGained: number;
}

export const TENURE_COHORTS = [
  { key: 'new', label: 'Joined under 90 days ago', minDays: 0, maxDays: 90 },
  {
    key: 'settled',
    label: 'Joined 90 days to a year ago',
    minDays: 90,
    maxDays: 365,
  },
  {
    key: 'veteran',
    label: 'Joined over a year ago',
    minDays: 365,
    maxDays: Infinity,
  },
] as const;

export type TenureCohortKey = (typeof TENURE_COHORTS)[number]['key'];

export interface ITenureCohort {
  key: TenureCohortKey;
  label: string;
  members: number;
  /** Percent of the cohort active in-game this window. */
  activeShare: number | null;
  /** Percent of the cohort that used any clan system this window. */
  usedSystemShare: number | null;
  /** Median EHB gained among the cohort's active members. */
  medianEhbActive: number;
  /** Percent of the cohort's active members at or above the PvM floor. */
  aboveFloorShare: number | null;
}

/**
 * The same rates for three join-date cohorts, so "are newer members different" is answered
 * with a comparison rather than a feeling. The newest cohort is partly survivorship (members
 * who joined and left are already off the roster), so read gaps as large or small, not exact.
 */
export const summarizeTenure = (
  members: ITenureMember[],
  now: Date,
  floor: number,
): ITenureCohort[] =>
  TENURE_COHORTS.map(cohort => {
    const own = members.filter(member => {
      const days = (now.getTime() - new Date(member.joined).getTime()) / DAY_MS;
      return days >= cohort.minDays && days < cohort.maxDays;
    });
    const active = own.filter(member => member.activeInGame);
    return {
      key: cohort.key,
      label: cohort.label,
      members: own.length,
      activeShare: share(active.length, own.length),
      usedSystemShare: share(
        own.filter(member => member.usedAnySystem).length,
        own.length,
      ),
      medianEhbActive:
        Math.round(median(active.map(member => member.ehbGained)) * 10) / 10,
      aboveFloorShare: share(
        active.filter(member => member.ehbGained >= floor).length,
        active.length,
      ),
    };
  });

// ---- Monthly flows ----

export interface IMonthlyActiveSet {
  /** YYYY-MM. */
  month: string;
  /** e.g. "Sep 2026". */
  label: string;
  activeIds: Set<string>;
}

export interface IMonthlyFlow {
  month: string;
  label: string;
  active: number;
  /** Percent of the roster active this month. */
  activeShare: number | null;
  /** Active last month, not this month. Null for the first month (nothing to compare). */
  churned: number | null;
  /** Not active last month, active this month. Null for the first month. */
  reactivated: number | null;
  /** Percent of last month's actives who churned. */
  churnRate: number | null;
}

/**
 * Month-over-month movement of the active set. Churn tells you how many people you are
 * losing, reactivation how many come back, and their difference is the net change hiding
 * inside a flat-looking active share.
 */
export const monthlyFlows = (
  months: IMonthlyActiveSet[],
  rosterSize: number,
): IMonthlyFlow[] =>
  months.map((current, index) => {
    const previous = index === 0 ? null : months[index - 1];
    const churned =
      previous === null
        ? null
        : [...previous.activeIds].filter(id => !current.activeIds.has(id))
            .length;
    const reactivated =
      previous === null
        ? null
        : [...current.activeIds].filter(id => !previous.activeIds.has(id))
            .length;
    return {
      month: current.month,
      label: current.label,
      active: current.activeIds.size,
      activeShare: share(current.activeIds.size, rosterSize),
      churned,
      reactivated,
      churnRate:
        previous === null || churned === null
          ? null
          : share(churned, previous.activeIds.size),
    };
  });

/** The UTC calendar months ending on the current one, oldest first. */
export const monthStarts = (months: number, now: Date): Date[] =>
  Array.from(
    { length: months },
    (_, index) =>
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - (months - 1 - index),
          1,
        ),
      ),
  );

export const monthLabel = (start: Date): string =>
  start.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const monthKey = (start: Date): string =>
  start.toISOString().slice(0, 7);

export const nextMonth = (start: Date): Date =>
  new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

/** Members with a clan-system action in each of the last `months` months, from the event log. */
export const clanSystemActiveByMonth = (
  events: IEngagementEvent[],
  months: number,
  now: Date,
): IMonthlyActiveSet[] =>
  monthStarts(months, now).map(start => ({
    month: monthKey(start),
    label: monthLabel(start),
    activeIds: distinctMembers(
      between(events, start.toISOString(), nextMonth(start).toISOString()),
    ),
  }));

// The adjusted lift lives beside scoreBounty in engagement.ts; re-exported for callers here.
export { adjustedLiftPercent } from '~/utils/engagement';
