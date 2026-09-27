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

// ---- Retention by join age ----

export const JOIN_AGE_BUCKETS = [
  { key: 'lt3m', label: 'Under 3 months', minDays: 0, maxDays: 90 },
  { key: '3to6m', label: '3 to 6 months', minDays: 90, maxDays: 180 },
  { key: '6to12m', label: '6 to 12 months', minDays: 180, maxDays: 365 },
  { key: '1to2y', label: '1 to 2 years', minDays: 365, maxDays: 730 },
  { key: '2yplus', label: 'Over 2 years', minDays: 730, maxDays: Infinity },
] as const;

export interface IRetentionMember {
  discordId: string;
  joined: string;
  /** Still a current member (on the roster). Leavers are false. */
  onRoster: boolean;
  activeInGame: boolean;
}

export interface IRetentionBucket {
  key: (typeof JOIN_AGE_BUCKETS)[number]['key'];
  label: string;
  /** Everyone who joined in this age band, leavers included. */
  joined: number;
  stillOnRoster: number;
  activeInGame: number;
  /** Percent of joiners still on the roster, or null for an empty band. */
  retained: number | null;
  /** Percent of joiners active in-game this period. */
  active: number | null;
}

/**
 * A survival curve by how long ago people joined: of everyone who joined in each band, how many
 * are still members and how many played this period. The step where retention drops is where
 * members are lost, which is more useful than any single churn number.
 */
export const retentionByJoinAge = (
  members: IRetentionMember[],
  now: Date,
): IRetentionBucket[] =>
  JOIN_AGE_BUCKETS.map(bucket => {
    const own = members.filter(member => {
      const days = (now.getTime() - new Date(member.joined).getTime()) / DAY_MS;
      return days >= bucket.minDays && days < bucket.maxDays;
    });
    const stillOnRoster = own.filter(member => member.onRoster).length;
    const activeInGame = own.filter(member => member.activeInGame).length;
    return {
      key: bucket.key,
      label: bucket.label,
      joined: own.length,
      stillOnRoster,
      activeInGame,
      retained: share(stillOnRoster, own.length),
      active: share(activeInGame, own.length),
    };
  });

// ---- New-member activation ----

export interface IJoiner {
  discordId: string;
  joined: string;
}

export interface IActivationFunnel {
  joined: number;
  within7Days: number;
  within30Days: number;
  ever: number;
  /** Median days from joining to the first clan-system action, among those who acted. */
  medianDaysToFirstAction: number | null;
}

/**
 * How quickly new members first touch a clan system. `firstActionAt` is each member's earliest
 * action on record; joiners with none, or whose first action predates their join date (a
 * re-join), count as not activated.
 */
export const activationFunnel = (
  joiners: IJoiner[],
  firstActionAt: Map<string, string>,
): IActivationFunnel => {
  const lags = joiners.flatMap(joiner => {
    const first = firstActionAt.get(joiner.discordId);
    const lag =
      first === undefined
        ? null
        : (new Date(first).getTime() - new Date(joiner.joined).getTime()) /
          DAY_MS;
    return lag === null || lag < 0 ? [] : [lag];
  });
  return {
    joined: joiners.length,
    within7Days: lags.filter(lag => lag <= 7).length,
    within30Days: lags.filter(lag => lag <= 30).length,
    ever: lags.length,
    medianDaysToFirstAction:
      lags.length === 0 ? null : Math.round(median(lags) * 10) / 10,
  };
};

/** Each member's earliest action, from any events list. */
export const firstActionByMember = (
  events: IEngagementEvent[],
): Map<string, string> =>
  new Map(
    [...events]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(event => [event.discordId, event.at]),
  );

// ---- PvM experience distribution ----

export const EHB_BUCKETS = [
  { key: 'b0', label: '<100', min: 0, max: 100 },
  { key: 'b100', label: '100 to 300', min: 100, max: 300 },
  { key: 'b300', label: '300 to 700', min: 300, max: 700 },
  { key: 'b700', label: '700 to 1,500', min: 700, max: 1500 },
  { key: 'b1500', label: '1,500+', min: 1500, max: Infinity },
] as const;

export interface IEhbBucket {
  key: (typeof EHB_BUCKETS)[number]['key'];
  label: string;
  members: number;
}

export interface IEhbDistribution {
  buckets: IEhbBucket[];
  members: number;
  median: number;
}

/** How the roster's lifetime PvM experience (total EHB per member) is spread. */
export const ehbDistribution = (totals: number[]): IEhbDistribution => ({
  buckets: EHB_BUCKETS.map(bucket => ({
    key: bucket.key,
    label: bucket.label,
    members: totals.filter(total => total >= bucket.min && total < bucket.max)
      .length,
  })),
  members: totals.length,
  median: Math.round(median(totals)),
});

// ---- Slayer funnel ----

export interface ISlayerSpin {
  status: string;
  spinType: string;
}

export interface ISlayerFunnel {
  spins: number;
  /** Spins that were the first task handed out, not a reroll or swap. */
  initialSpins: number;
  completed: number;
  replaced: number;
  /** Percent of spins that ended in a completion. */
  completionRate: number | null;
  /** How many spins it takes, on average, to reach one completed task. */
  spinsPerCompletion: number | null;
}

/** Spins in, tasks out: the health of the task pool and the reroll economy in two numbers. */
export const slayerFunnel = (spins: ISlayerSpin[]): ISlayerFunnel => {
  const completed = spins.filter(spin => spin.status === 'COMPLETED').length;
  return {
    spins: spins.length,
    initialSpins: spins.filter(spin => spin.spinType === 'INITIAL').length,
    completed,
    replaced: spins.filter(spin => spin.status === 'REPLACED').length,
    completionRate: share(completed, spins.length),
    spinsPerCompletion:
      completed === 0 ? null : Math.round((spins.length / completed) * 10) / 10,
  };
};
