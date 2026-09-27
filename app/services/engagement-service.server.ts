import { Metric } from '@wise-old-man/utils';
import { getBounties } from '~/data/bounties';
import { getPersonalBestsSince } from '~/data/personal-bests';
import { getAuditDataForDateRange } from '~/data/points-audit';
import { getRaidCompletionsSince } from '~/data/raid-completions';
import { getSpinsSince } from '~/data/slayer';
import { getAllUserAlts } from '~/data/user';
import {
  getUsersWithNicknames,
  ISanguineUserWithNickname,
} from '~/services/sanguine-service.server';
import {
  getClanFromWom,
  getGroupGainsForWindow,
} from '~/services/wom-api-service.server';
import { normalizeRsn } from '~/utils/collection-log';
import {
  bountyMeasurementWindow,
  IBountyScorecard,
  IBountyWindow,
  IEngagementEvent,
  ALL_RAIDS_METRIC,
  IPvmActivity,
  ISkillingMember,
  PVM_METRICS,
  pvmFloorForDays,
  RAID_METRICS,
  scoreBounty,
  summarizeSkillingOnly,
  sumGainsByPlayer,
  summarizePvmActivity,
} from '~/utils/engagement';
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
  const rows = await getBounties();
  const bounty = rows.find(row => row.id === bountyId);
  if (!bounty) {
    return null;
  }
  const window = bountyMeasurementWindow(bounty, now);
  const metric = bounty.task.bossMetric as Metric;
  const [during, before] = await Promise.all([
    getGroupGainsForWindow(
      metric,
      new Date(window.start),
      new Date(window.end),
    ),
    getGroupGainsForWindow(
      metric,
      new Date(window.baselineStart),
      new Date(window.baselineEnd),
    ),
  ]);
  return {
    bountyId,
    window,
    scorecard: scoreBounty({
      during,
      before,
      claimCount: bounty.claims.length,
      postedAt: bounty.postedAt,
      closedAt: bounty.closedAt,
      status: bounty.status,
    }),
  };
};

/**
 * Every system touch on or after `since`: one event per drop posted, competition placing, task
 * spun, bounty claim, and per participant of each raid or PB submission.
 */
export const getEngagementEvents = async (
  since: string,
): Promise<IEngagementEvent[]> => {
  const [audits, spins, bounties, raids, personalBests] = await Promise.all([
    getAuditDataForDateRange(since, new Date().toISOString()),
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
    ...spins.map(spin => ({
      system: 'slayer' as const,
      discordId: spin.discordId,
      at: spin.spunAt,
    })),
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
  const gains =
    metric === ALL_RAIDS_METRIC
      ? sumGainsByPlayer(
          await Promise.all(
            RAID_METRICS.map(raid =>
              getGroupGainsForWindow(raid as Metric, start, now),
            ),
          ),
        )
      : await getGroupGainsForWindow(metric, start, now);
  return {
    metric,
    days,
    start: start.toISOString(),
    end: now.toISOString(),
    activity: summarizePvmActivity(gains),
  };
};

export interface IInGameActivity {
  /** Latest WOM lastChangedAt across the member's main and alts, as ISO, or null if unknown. */
  lastChangedAt: string | null;
  /** The main account's WOM group role, falling back to whichever account matched first. */
  role: string;
}

/**
 * What WOM last saw each roster member do in-game, from the (cached) group membership list:
 * no extra WOM calls. Accounts map to members through nicknames and registered alts, the same
 * bridge the collection log uses; members with no account in the group are simply absent.
 */
type UserAlt = Awaited<ReturnType<typeof getAllUserAlts>>[number];

/** Normalized RSN (nickname or registered alt) to the owning member's discordId. */
const discordIdByRsnFor = (
  users: ISanguineUserWithNickname[],
  alts: UserAlt[],
): Map<string, string> =>
  new Map([
    ...users
      .filter(user => user.nickname)
      .map(
        user => [normalizeRsn(user.nickname ?? ''), user.discordId] as const,
      ),
    ...alts.map(alt => [normalizeRsn(alt.altName), alt.discordId] as const),
  ]);

export const getInGameActivityByDiscordId = async (
  users: ISanguineUserWithNickname[],
): Promise<Map<string, IInGameActivity>> => {
  const [alts, memberships] = await Promise.all([
    getAllUserAlts(),
    getClanFromWom(),
  ]);
  const named = users.filter(user => user.nickname);
  const discordIdByRsn = discordIdByRsnFor(users, alts);
  const mainRsnByDiscordId = new Map(
    named.map(user => [user.discordId, normalizeRsn(user.nickname ?? '')]),
  );
  return memberships.reduce<Map<string, IInGameActivity>>((acc, membership) => {
    const rsn = normalizeRsn(membership.player.displayName);
    const discordId = discordIdByRsn.get(rsn);
    if (discordId === undefined) {
      return acc;
    }
    const changedAt = membership.player.lastChangedAt
      ? new Date(membership.player.lastChangedAt).toISOString()
      : null;
    const current = acc.get(discordId);
    const latest = [current?.lastChangedAt ?? null, changedAt]
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1);
    return acc.set(discordId, {
      lastChangedAt: latest ?? null,
      role:
        current === undefined || mainRsnByDiscordId.get(discordId) === rsn
          ? membership.role
          : current.role,
    });
  }, new Map());
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
  const users = await getUsersWithNicknames();
  const [inGame, alts, ehb, ehp] = await Promise.all([
    getInGameActivityByDiscordId(users),
    getAllUserAlts(),
    getGroupGainsForWindow(Metric.EHB, start, now),
    getGroupGainsForWindow(Metric.EHP, start, now),
  ]);
  const discordIdByRsn = discordIdByRsnFor(users, alts);
  const gainedByMember = (gains: { displayName: string; gained: number }[]) =>
    gains.reduce<Map<string, number>>((acc, gain) => {
      const discordId = discordIdByRsn.get(normalizeRsn(gain.displayName));
      return discordId === undefined
        ? acc
        : acc.set(discordId, (acc.get(discordId) ?? 0) + gain.gained);
    }, new Map());
  const ehbByMember = gainedByMember(ehb);
  const ehpByMember = gainedByMember(ehp);
  const nameByDiscordId = new Map(
    users.map(user => [user.discordId, user.nickname ?? null]),
  );
  const floor = pvmFloorForDays(days);
  return {
    days,
    floor,
    start: start.toISOString(),
    end: now.toISOString(),
    rows: summarizeSkillingOnly(
      users.map(user => ({
        discordId: user.discordId,
        womRole: inGame.get(user.discordId)?.role ?? null,
        lastInGameChangeAt: inGame.get(user.discordId)?.lastChangedAt ?? null,
        ehbGained: ehbByMember.get(user.discordId) ?? 0,
        ehpGained: ehpByMember.get(user.discordId) ?? 0,
      })),
      start.toISOString(),
      now,
      floor,
    ).map(row => ({
      ...row,
      name: nameByDiscordId.get(row.discordId) ?? null,
    })),
  };
};
