// Clan engagement insights: pure aggregation over the rows the bot already writes (audits,
// spins, bounty claims, raid and PB submissions) and the per-member deltas WOM returns for a
// window. Nothing here is persisted; every number is derived on demand from those two sources.

/** How often the bot pushes a group update to WOM, in hours. */
export const WOM_UPDATE_INTERVAL_HOURS = 24;

const HOUR_MS = 3_600_000;

export interface IBountyWindowInput {
  postedAt: string;
  closedAt: string | null;
}

export interface IBountyWindow {
  /** Measured interval, as ISO strings. */
  start: string;
  end: string;
  /** The equal-length interval immediately before it. */
  baselineStart: string;
  baselineEnd: string;
  /** False while the update that captures the end of the window hasn't happened yet. */
  settled: boolean;
}

/**
 * The WOM window a bounty is measured over. WOM deltas run from the first snapshot at or after
 * the start to the last at or before the end, and the bot only snapshots once per update
 * interval, so the window is padded by one interval on each side: back, so the update before the
 * bounty opened anchors the delta, and forward, so the update after it closed captures kills late
 * in the run. The forward pad is capped at "now" and marks the window unsettled until it passes.
 * The baseline is the same length of time immediately before the measured start.
 */
export const bountyMeasurementWindow = (
  { postedAt, closedAt }: IBountyWindowInput,
  now: Date,
  updateIntervalHours: number = WOM_UPDATE_INTERVAL_HOURS,
): IBountyWindow => {
  const pad = updateIntervalHours * HOUR_MS;
  const start = new Date(postedAt).getTime() - pad;
  const wantedEnd = closedAt
    ? new Date(closedAt).getTime() + pad
    : now.getTime();
  const end = Math.min(wantedEnd, now.getTime());
  const length = end - start;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    baselineStart: new Date(start - length).toISOString(),
    baselineEnd: new Date(start).toISOString(),
    settled: closedAt !== null && wantedEnd <= now.getTime(),
  };
};

export interface IMemberGainLike {
  displayName: string;
  gained: number;
}

export interface IBountyScoreInput {
  during: IMemberGainLike[];
  before: IMemberGainLike[];
  claimCount: number;
  postedAt: string;
  closedAt: string | null;
  status: string;
}

export interface IBountyParticipant {
  displayName: string;
  gained: number;
}

export interface IBountyScorecard {
  /** Members who killed the boss at least once while the bounty was measured. */
  participants: number;
  /** Members who killed it in the equal-length window before it opened. */
  baselineParticipants: number;
  /** participants minus baseline: how many extra members the bounty pulled in. */
  lift: number;
  /** lift over baseline, or null when nobody was killing it beforehand. */
  liftPercent: number | null;
  killsDuring: number;
  killsBefore: number;
  claimCount: number;
  /** Hours from posting to close, or null while still open. */
  hoursOpen: number | null;
  /** Participants by kills, most first. */
  topParticipants: IBountyParticipant[];
}

const gainers = (rows: IMemberGainLike[]) => rows.filter(row => row.gained > 0);

const sumGained = (rows: IMemberGainLike[]) =>
  rows.reduce((sum, row) => sum + row.gained, 0);

/** Turns the two WOM windows and the bounty's own record into the scorecard the admin page shows. */
export const scoreBounty = (
  { during, before, claimCount, postedAt, closedAt }: IBountyScoreInput,
  topLimit: number = 10,
): IBountyScorecard => {
  const duringGainers = gainers(during);
  const beforeGainers = gainers(before);
  const participants = duringGainers.length;
  const baselineParticipants = beforeGainers.length;
  const lift = participants - baselineParticipants;
  return {
    participants,
    baselineParticipants,
    lift,
    liftPercent:
      baselineParticipants === 0
        ? null
        : Math.round((lift / baselineParticipants) * 100),
    killsDuring: sumGained(duringGainers),
    killsBefore: sumGained(beforeGainers),
    claimCount,
    hoursOpen: closedAt
      ? Math.round(
          (new Date(closedAt).getTime() - new Date(postedAt).getTime()) /
            HOUR_MS,
        )
      : null,
    topParticipants: [...duringGainers]
      .sort((a, b) => b.gained - a.gained)
      .slice(0, topLimit)
      .map(({ displayName, gained }) => ({ displayName, gained })),
  };
};

// ---- Systems engagement ----

/** The clan systems a member can engage with, in display order. */
export const ENGAGEMENT_SYSTEMS = [
  'drops',
  'competitions',
  'slayer',
  'bounties',
  'raids',
  'personalBests',
] as const;

export type EngagementSystem = (typeof ENGAGEMENT_SYSTEMS)[number];

export const ENGAGEMENT_SYSTEM_LABELS: Record<EngagementSystem, string> = {
  drops: 'Drops',
  competitions: 'Competitions',
  slayer: 'Sanguine Slayer',
  bounties: 'Bounties',
  raids: 'Raid submissions',
  personalBests: 'Personal bests',
};

/** Column-header length labels for dense tables. */
export const ENGAGEMENT_SYSTEM_SHORT_LABELS: Record<EngagementSystem, string> =
  {
    drops: 'Drops',
    competitions: 'Comps',
    slayer: 'Slayer',
    bounties: 'Bounties',
    raids: 'Raids',
    personalBests: 'PBs',
  };

/** One touch of one system by one member: a drop posted, a task spun, a claim, a submission. */
export interface IEngagementEvent {
  system: EngagementSystem;
  discordId: string;
  /** ISO-8601 UTC, so string comparison is time order. */
  at: string;
}

export interface ISystemEngagement {
  system: EngagementSystem;
  /** Distinct members who touched the system in the window. */
  members: number;
  events: number;
}

export interface IMemberEngagement {
  discordId: string;
  /** The systems touched, in display order. */
  systems: EngagementSystem[];
  events: number;
}

export interface IEngagementSummary {
  bySystem: ISystemEngagement[];
  /** Every member with at least one event, most systems first, then most events. */
  byMember: IMemberEngagement[];
  /** Distinct members with at least one event anywhere. */
  activeMembers: number;
}

const inWindow = (events: IEngagementEvent[], start: string, end: string) =>
  events.filter(event => event.at >= start && event.at < end);

const groupByMember = (events: IEngagementEvent[]) =>
  events.reduce<Map<string, IEngagementEvent[]>>(
    (acc, event) =>
      acc.set(event.discordId, [...(acc.get(event.discordId) ?? []), event]),
    new Map(),
  );

/** Which systems saw activity, and who touched how many of them, within [start, end). */
export const summarizeEngagement = (
  events: IEngagementEvent[],
  start: string,
  end: string,
): IEngagementSummary => {
  const windowed = inWindow(events, start, end);
  const bySystem = ENGAGEMENT_SYSTEMS.map(system => {
    const rows = windowed.filter(event => event.system === system);
    return {
      system,
      members: new Set(rows.map(row => row.discordId)).size,
      events: rows.length,
    };
  });
  const byMember = [...groupByMember(windowed).entries()]
    .map(([discordId, rows]) => ({
      discordId,
      systems: ENGAGEMENT_SYSTEMS.filter(system =>
        rows.some(row => row.system === system),
      ),
      events: rows.length,
    }))
    .sort(
      (a, b) =>
        b.systems.length - a.systems.length ||
        b.events - a.events ||
        a.discordId.localeCompare(b.discordId),
    );
  return { bySystem, byMember, activeMembers: byMember.length };
};

export interface IMonthlyEngagement {
  /** YYYY-MM. */
  month: string;
  /** e.g. "Sep 2026". */
  label: string;
  members: Record<EngagementSystem, number>;
  activeMembers: number;
}

/**
 * Distinct members per system per calendar month for the last `months` months, oldest first, the
 * current (partial) month included. Months are UTC so they line up with the bot's timestamps.
 */
export const monthlyEngagementSeries = (
  events: IEngagementEvent[],
  months: number,
  now: Date,
): IMonthlyEngagement[] => {
  const monthStart = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return Array.from({ length: months }, (_, index) =>
    monthStart(index - (months - 1)),
  ).map(start => {
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
    const summary = summarizeEngagement(
      events,
      start.toISOString(),
      end.toISOString(),
    );
    return {
      month: start.toISOString().slice(0, 7),
      label: start.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      members: Object.fromEntries(
        summary.bySystem.map(row => [row.system, row.members]),
      ) as Record<EngagementSystem, number>,
      activeMembers: summary.activeMembers,
    };
  });
};

// ---- PvM activity (WOM) ----

export interface IPvmActivity {
  /** Members whose metric moved at all in the window. */
  activeMembers: number;
  totalGained: number;
  /** Gainers by amount, most first. */
  top: IBountyParticipant[];
}

/** Who did the content in a window, from one metric's group gains. */
export const summarizePvmActivity = (
  gains: IMemberGainLike[],
  topLimit: number = 15,
): IPvmActivity => {
  const rows = gainers(gains);
  return {
    activeMembers: rows.length,
    totalGained: sumGained(rows),
    top: [...rows]
      .sort((a, b) => b.gained - a.gained)
      .slice(0, topLimit)
      .map(({ displayName, gained }) => ({ displayName, gained })),
  };
};

/** The WOM metrics the PvM activity view can be pointed at, in menu order. Plain strings so the
 * page can render the menu without pulling the WOM client into the browser bundle. */
export const PVM_METRICS: { metric: string; label: string }[] = [
  { metric: 'ehb', label: 'All PvM (EHB)' },
  { metric: 'chambers_of_xeric', label: 'Chambers of Xeric' },
  { metric: 'chambers_of_xeric_challenge_mode', label: 'Chambers of Xeric CM' },
  { metric: 'theatre_of_blood', label: 'Theatre of Blood' },
  { metric: 'theatre_of_blood_hard_mode', label: 'Theatre of Blood HM' },
  { metric: 'tombs_of_amascut', label: 'Tombs of Amascut' },
  { metric: 'tombs_of_amascut_expert', label: 'Tombs of Amascut Expert' },
  { metric: 'yama', label: 'Yama' },
  { metric: 'the_royal_titans', label: 'Royal Titans' },
  { metric: 'doom_of_mokhaiotl', label: 'Doom of Mokhaiotl' },
  { metric: 'nex', label: 'Nex' },
  { metric: 'nightmare', label: 'Nightmare' },
];

export const PVM_PERIOD_DAYS = [7, 30, 90] as const;
