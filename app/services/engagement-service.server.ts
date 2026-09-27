import { remember } from '@epic-web/remember';
import { Metric } from '@wise-old-man/utils';
import { getBounties, getBountyById } from '~/data/bounties';
import { getPersonalBestsSince } from '~/data/personal-bests';
import { getAuditEventsSince } from '~/data/points-audit';
import { getRaidCompletionsSince } from '~/data/raid-completions';
import { getSpinsSince } from '~/data/slayer';
import {
  getRsnMemberBridge,
  IRsnMemberBridge,
} from '~/services/member-lookup.server';
import {
  getClanFromWom,
  getGroupGainsForWindow,
  IMemberGain,
} from '~/services/wom-api-service.server';
import { normalizeRsn } from '~/utils/collection-log';
import {
  bountyMeasurementWindow,
  IBountyScorecard,
  IBountyWindow,
  IEngagementEvent,
  IMemberGainLike,
  ALL_RAIDS_METRIC,
  FetchOutcome,
  IPvmActivity,
  IInGameSplit,
  ISkillingMember,
  PVM_METRICS,
  pvmFloorForDays,
  RAID_METRICS,
  scoreBounty,
  summarizeInGameSplit,
  summarizeSkillingOnly,
  sumGainsByPlayer,
  summarizePvmActivity,
} from '~/utils/engagement';
import {
  IMonthlyFlow,
  ITenureCohort,
  monthKey,
  monthLabel,
  monthlyFlows,
  monthStarts,
  nextMonth,
  summarizeTenure,
} from '~/utils/engagement-stats';
import { getSlayerBossImageUrl } from '~/utils/slayer';

// Clan insights for the admin portal. Two questions, both answered from data that already
// exists: "did this bounty get people to do the content" (the bounty's own record plus WOM's
// per-member deltas over its window) and "who is engaging with which clan systems" (the rows
// the bot writes for drops, competitions, slayer, bounties, raids, and PBs). Nothing is stored;
// WOM is the system of record for point-in-time state and its calls sit behind a cache.

const DAY_MS = 24 * 60 * 60 * 1000;
// Live windows (an open bounty, "the last N days") end at "now". Rounding that down to a bucket
// keeps the WOM cache key stable across page views within the bucket, so an admin refreshing the
// page doesn't re-read the group each time. Matches the live TTL in the WOM service.
const LIVE_BUCKET_MS = 15 * 60 * 1000;

const bucketedNow = () =>
  new Date(Math.floor(Date.now() / LIVE_BUCKET_MS) * LIVE_BUCKET_MS);

/** The bounty fields the insights page lists before any WOM call is made. */
export interface IBountyListing {
  id: string;
  bossMetric: string;
  bossDisplayName: string;
  bossImageUrl: string;
  status: string;
  maxWinners: number;
  claimCount: number;
  postedAt: string;
  closedAt: string | null;
}

export const getBountyListings = async (): Promise<IBountyListing[]> => {
  const rows = await getBounties();
  return rows.map(row => ({
    id: row.id,
    bossMetric: row.task.bossMetric,
    bossDisplayName: row.task.bossDisplayName,
    bossImageUrl: getSlayerBossImageUrl(
      row.task.bossMetric,
      row.task.bossDisplayName,
    ),
    status: row.status,
    maxWinners: row.maxWinners,
    claimCount: row.claims.length,
    postedAt: row.postedAt,
    closedAt: row.closedAt,
  }));
};

/**
 * Folds per-account WOM gains into one row per clan member (main plus registered alts, named
 * by nickname), leaving accounts the bridge can't place as their own rows. A member playing on
 * an alt is still that member doing the content.
 */
const foldGainsByMember = (
  gains: Pick<IMemberGain, 'displayName' | 'gained'>[],
  bridge: IRsnMemberBridge,
): IMemberGainLike[] => {
  const nameByDiscordId = new Map(
    bridge.roster.map(user => [user.discordId, user.nickname ?? '']),
  );
  const owned = gains.map(gain => ({
    ...gain,
    discordId:
      bridge.discordIdByRsn.get(normalizeRsn(gain.displayName)) ?? null,
  }));
  const members = [
    ...new Set(
      owned
        .map(gain => gain.discordId)
        .filter((id): id is string => id !== null),
    ),
  ].map(discordId => ({
    discordId,
    displayName: nameByDiscordId.get(discordId) || discordId,
    gained: owned
      .filter(gain => gain.discordId === discordId)
      .reduce((sum, gain) => sum + gain.gained, 0),
  }));
  const strays = owned
    .filter(gain => gain.discordId === null)
    .map(({ displayName, gained }) => ({
      displayName,
      gained,
      discordId: null,
    }));
  return [...members, ...strays];
};

export interface IBountyScorecardResult {
  bountyId: string;
  window: IBountyWindow;
  scorecard: IBountyScorecard;
}

/** The scorecard for one bounty: two WOM group-gains reads (its window and the baseline). */
export const getBountyScorecard = async (
  bountyId: string,
  now: Date = bucketedNow(),
): Promise<IBountyScorecardResult | null> => {
  const bounty = await getBountyById(bountyId);
  if (!bounty) {
    return null;
  }
  const window = bountyMeasurementWindow(bounty, now);
  const metric = bounty.task.bossMetric as Metric;
  const duringWindow = [new Date(window.start), new Date(window.end)] as const;
  const beforeWindow = [
    new Date(window.baselineStart),
    new Date(window.baselineEnd),
  ] as const;
  // Four reads, all cached once the windows settle: the boss in each window, and all PvM (EHB)
  // in each window as the control for the clan's overall movement.
  const [bridge, during, before, controlDuring, controlBefore] =
    await Promise.all([
      getRsnMemberBridge(),
      getGroupGainsForWindow(metric, ...duringWindow),
      getGroupGainsForWindow(metric, ...beforeWindow),
      getGroupGainsForWindow(Metric.EHB, ...duringWindow),
      getGroupGainsForWindow(Metric.EHB, ...beforeWindow),
    ]);
  const activeCount = (gains: IMemberGain[]) =>
    foldGainsByMember(gains, bridge).filter(row => row.gained > 0).length;
  return {
    bountyId,
    window,
    scorecard: scoreBounty({
      during: foldGainsByMember(during, bridge),
      before: foldGainsByMember(before, bridge),
      controlDuring: activeCount(controlDuring),
      controlBefore: activeCount(controlBefore),
      claimCount: bounty.claims.length,
      postedAt: bounty.postedAt,
      closedAt: bounty.closedAt,
      status: bounty.status,
    }),
  };
};

interface IEventsCacheEntry {
  since: string;
  fetchedAt: number;
  events: IEngagementEvent[];
}

// The six-month audit read is a multi-second collection scan on the live database, and the page
// loader runs on every period change while the skilling route needs the same rows for a narrower
// window. One process-wide copy, a few minutes old at most, serves any window inside it.
const EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const eventsCache = remember('engagementEvents', () => ({
  entry: null as IEventsCacheEntry | null,
}));

/**
 * Every system touch on or after `since`: one event per drop posted, competition placing, Slayer
 * spin or completion, bounty claim, and per participant of each raid or PB submission. Served
 * from a short-lived process cache when a fresh read already covers the window.
 */
export const getEngagementEvents = async (
  since: string,
): Promise<IEngagementEvent[]> => {
  const cached = eventsCache.entry;
  if (
    cached &&
    cached.since <= since &&
    Date.now() - cached.fetchedAt < EVENTS_CACHE_TTL_MS
  ) {
    return cached.since === since
      ? cached.events
      : cached.events.filter(event => event.at >= since);
  }
  const events = await readEngagementEvents(since);
  eventsCache.entry = { since, fetchedAt: Date.now(), events };
  return events;
};

const readEngagementEvents = async (
  since: string,
): Promise<IEngagementEvent[]> => {
  const [audits, spins, bounties, raids, personalBests] = await Promise.all([
    getAuditEventsSince(since),
    getSpinsSince(since),
    getBounties(),
    getRaidCompletionsSince(since),
    getPersonalBestsSince(since),
  ]);
  return [
    ...audits
      .filter(audit => audit.type === 'AUTOMATED')
      .map(audit => ({
        system: 'drops' as const,
        discordId: audit.destinationDiscordId,
        at: audit.createdAt,
      })),
    ...audits
      .filter(audit => audit.type === 'COMPETITION')
      .map(audit => ({
        system: 'competitions' as const,
        discordId: audit.destinationDiscordId,
        at: audit.createdAt,
      })),
    // A spin (or reroll) is one interaction; finishing the task is another.
    ...spins.flatMap(spin => [
      { system: 'slayer' as const, discordId: spin.discordId, at: spin.spunAt },
      ...(spin.completion
        ? [
            {
              system: 'slayer' as const,
              discordId: spin.discordId,
              at: spin.completion.completedAt,
            },
          ]
        : []),
    ]),
    ...bounties.flatMap(bounty =>
      bounty.claims
        .filter(claim => claim.claimedAt >= since)
        .map(claim => ({
          system: 'bounties' as const,
          discordId: claim.discordId,
          at: claim.claimedAt,
        })),
    ),
    ...raids.flatMap(raid =>
      raid.participantDiscordIds.map(discordId => ({
        system: 'raids' as const,
        discordId,
        at: raid.approvedAt,
      })),
    ),
    ...personalBests.flatMap(pb =>
      pb.participantDiscordIds.map(discordId => ({
        system: 'personalBests' as const,
        discordId,
        at: pb.createdAt,
      })),
    ),
  ];
};

/** A WOM metric from the menu, or the virtual "all raids" key. */
export type PvmMetricKey = Metric | typeof ALL_RAIDS_METRIC;

export const isPvmMetricKey = (value: string): value is PvmMetricKey =>
  PVM_METRICS.some(option => option.metric === value);

/** What the PvM view opens on: the first menu entry, all PvM as efficient hours bossed. */
export const DEFAULT_PVM_METRIC: PvmMetricKey = Metric.EHB;

export interface IPvmActivityResult {
  metric: PvmMetricKey;
  days: number;
  start: string;
  end: string;
  activity: IPvmActivity;
}

/** Who moved a metric over the last `days` days, from one WOM group-gains read. */
export const getPvmActivity = async (
  metric: PvmMetricKey,
  days: number,
  now: Date = bucketedNow(),
): Promise<IPvmActivityResult> => {
  const start = new Date(now.getTime() - days * DAY_MS);
  // "All raids" is one read per raid metric (each cached on its own), summed per player.
  const [bridge, gains] = await Promise.all([
    getRsnMemberBridge(),
    metric === ALL_RAIDS_METRIC
      ? Promise.all(
          RAID_METRICS.map(raid =>
            getGroupGainsForWindow(raid as Metric, start, now),
          ),
        ).then(lists => sumGainsByPlayer(lists))
      : getGroupGainsForWindow(metric, start, now),
  ]);
  return {
    metric,
    days,
    start: start.toISOString(),
    end: now.toISOString(),
    activity: summarizePvmActivity(foldGainsByMember(gains, bridge)),
  };
};

export interface IInGameActivity {
  /** Latest WOM lastChangedAt across the member's main and alts, as ISO, or null if unknown. */
  lastChangedAt: string | null;
  /** The registered alt that latest change happened on, or null when it was the main. */
  activeAlt: string | null;
  /** The main account's WOM group role, falling back to whichever account matched first. */
  role: string;
}

/**
 * What WOM last saw each roster member do in-game, from the (cached) group membership list:
 * no extra WOM calls. Accounts map to members through nicknames and registered alts, the same
 * bridge the collection log uses; members with no account in the group are simply absent.
 */
export const getInGameActivityByDiscordId = async (
  bridge: IRsnMemberBridge,
): Promise<Map<string, IInGameActivity>> => {
  const memberships = await getClanFromWom();
  const { discordIdByRsn, roster: users } = bridge;
  const named = users;
  const mainRsnByDiscordId = new Map(
    named.map(user => [user.discordId, normalizeRsn(user.nickname ?? '')]),
  );
  // Each account in the group, tagged with the member it belongs to (unmapped ones dropped).
  const accounts = memberships.flatMap(membership => {
    const rsn = normalizeRsn(membership.player.displayName);
    const discordId = discordIdByRsn.get(rsn);
    return discordId === undefined
      ? []
      : [
          {
            discordId,
            rsn,
            displayName: membership.player.displayName,
            role: membership.role,
            changedAt: membership.player.lastChangedAt
              ? new Date(membership.player.lastChangedAt).toISOString()
              : null,
          },
        ];
  });
  return new Map(
    [...new Set(accounts.map(account => account.discordId))].map(discordId => {
      const own = accounts.filter(account => account.discordId === discordId);
      const main = own.find(
        account => mainRsnByDiscordId.get(discordId) === account.rsn,
      );
      const latest = own
        .filter(
          (account): account is typeof account & { changedAt: string } =>
            account.changedAt !== null,
        )
        .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
        .at(-1);
      const onAlt = latest !== undefined && latest !== main;
      return [
        discordId,
        {
          lastChangedAt: latest?.changedAt ?? null,
          activeAlt: onAlt ? latest.displayName : null,
          role: (main ?? own[0]).role,
        },
      ];
    }),
  );
};

export interface ISkillingRow extends ISkillingMember {
  name: string | null;
}

export interface ISkillingResult {
  days: number;
  /** EHB gained below which a member counts as not doing PvM over this window. */
  floor: number;
  start: string;
  end: string;
  rows: ISkillingRow[];
  /** The whole roster by what it gained, for the composition bar. */
  split: IInGameSplit;
  /** The same rates by join-date cohort. */
  tenure: ITenureCohort[];
}

/**
 * Members active in-game over the last `days` days who gained almost no efficient hours
 * bossed: two cached WOM group reads (EHB and EHP), summed per member across their accounts,
 * against the cached membership list for in-game activity.
 */
export const getSkillingOnly = async (
  days: number,
  now: Date = bucketedNow(),
): Promise<ISkillingResult> => {
  const start = new Date(now.getTime() - days * DAY_MS);
  const [bridge, ehb, ehp, events] = await Promise.all([
    getRsnMemberBridge(),
    getGroupGainsForWindow(Metric.EHB, start, now),
    getGroupGainsForWindow(Metric.EHP, start, now),
    getEngagementEvents(start.toISOString()),
  ]);
  const inGame = await getInGameActivityByDiscordId(bridge);
  const usedAnySystem = new Set(events.map(event => event.discordId));
  const { discordIdByRsn, roster: users } = bridge;
  // Sum each metric's gains per member across their main and alts.
  const gainedByMember = (gains: IMemberGainLike[]): Map<string, number> => {
    const owned = gains.flatMap(gain => {
      const discordId = discordIdByRsn.get(normalizeRsn(gain.displayName));
      return discordId === undefined
        ? []
        : [{ discordId, gained: gain.gained }];
    });
    return new Map(
      [...new Set(owned.map(gain => gain.discordId))].map(discordId => [
        discordId,
        owned
          .filter(gain => gain.discordId === discordId)
          .reduce((sum, gain) => sum + gain.gained, 0),
      ]),
    );
  };
  const ehbByMember = gainedByMember(ehb);
  const ehpByMember = gainedByMember(ehp);
  const nameByDiscordId = new Map(
    users.map(user => [user.discordId, user.nickname ?? null]),
  );
  const floor = pvmFloorForDays(days);
  const members = users.map(user => ({
    discordId: user.discordId,
    womRole: inGame.get(user.discordId)?.role ?? null,
    lastInGameChangeAt: inGame.get(user.discordId)?.lastChangedAt ?? null,
    activeAlt: inGame.get(user.discordId)?.activeAlt ?? null,
    ehbGained: ehbByMember.get(user.discordId) ?? 0,
    ehpGained: ehpByMember.get(user.discordId) ?? 0,
  }));
  return {
    days,
    floor,
    start: start.toISOString(),
    end: now.toISOString(),
    rows: summarizeSkillingOnly(members, start.toISOString(), now, floor).map(
      row => ({ ...row, name: nameByDiscordId.get(row.discordId) ?? null }),
    ),
    split: summarizeInGameSplit(members, floor),
    tenure: summarizeTenure(
      users.map(user => ({
        discordId: user.discordId,
        joined: user.joined,
        activeInGame:
          (inGame.get(user.discordId)?.lastChangedAt ?? '') >=
          start.toISOString(),
        usedAnySystem: usedAnySystem.has(user.discordId),
        ehbGained: ehbByMember.get(user.discordId) ?? 0,
      })),
      now,
      floor,
    ),
  };
};

export interface IInGameMonthsResult {
  months: IMonthlyFlow[];
}

/**
 * Who played in each of the last `count` calendar months, from one WOM overall-experience
 * read per month (any xp gain means they played; bossing gives xp too). Past months settle and
 * cache for the process lifetime, so after the first view only the current month is re-read.
 */
export const getInGameMonths = async (
  count: number,
  now: Date = bucketedNow(),
): Promise<IInGameMonthsResult> => {
  const starts = monthStarts(count, now);
  const [bridge, gains] = await Promise.all([
    getRsnMemberBridge(),
    Promise.all(
      starts.map(start =>
        getGroupGainsForWindow(
          Metric.OVERALL,
          start,
          new Date(Math.min(nextMonth(start).getTime(), now.getTime())),
        ),
      ),
    ),
  ]);
  const months = starts.map((start, index) => ({
    month: monthKey(start),
    label: monthLabel(start),
    activeIds: new Set(
      foldGainsByMember(gains[index], bridge)
        .filter(row => row.gained > 0 && row.discordId)
        .map(row => row.discordId as string),
    ),
  }));
  return { months: monthlyFlows(months, bridge.roster.length) };
};

/**
 * Runs a WOM-backed read for a resource route, turning a failure into a payload the page can
 * render as a retry state. Wise Old Man is a volunteer service; a 429 or a timeout must not
 * unmount the whole insights page through the root error boundary.
 */
export const womOutcome = async <T extends object>(
  read: () => Promise<T>,
): Promise<FetchOutcome<T>> => {
  try {
    return { ok: true, ...(await read()) };
  } catch (error) {
    console.error('insights: Wise Old Man read failed', error);
    return { ok: false, error: 'Wise Old Man did not answer.' };
  }
};
