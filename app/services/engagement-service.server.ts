import { Metric } from '@wise-old-man/utils';
import { getBounties } from '~/data/bounties';
import { getPersonalBestsSince } from '~/data/personal-bests';
import { getAuditDataForDateRange } from '~/data/points-audit';
import { getRaidCompletionsSince } from '~/data/raid-completions';
import { getSpinsSince } from '~/data/slayer';
import { getGroupGainsForWindow } from '~/services/wom-api-service.server';
import {
  bountyMeasurementWindow,
  IBountyScorecard,
  IBountyWindow,
  IEngagementEvent,
  IPvmActivity,
  PVM_METRICS,
  scoreBounty,
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

export const isPvmMetric = (value: string): value is Metric =>
  PVM_METRICS.some(option => option.metric === value);

/** What the PvM view opens on: the first menu entry, all PvM as efficient hours bossed. */
export const DEFAULT_PVM_METRIC: Metric = Metric.EHB;

export interface IPvmActivityResult {
  metric: Metric;
  days: number;
  start: string;
  end: string;
  activity: IPvmActivity;
}

/** Who moved a metric over the last `days` days, from one WOM group-gains read. */
export const getPvmActivity = async (
  metric: Metric,
  days: number,
  now: Date = bucketedNow(),
): Promise<IPvmActivityResult> => {
  const start = new Date(now.getTime() - days * DAY_MS);
  const gains = await getGroupGainsForWindow(metric, start, now);
  return {
    metric,
    days,
    start: start.toISOString(),
    end: now.toISOString(),
    activity: summarizePvmActivity(gains),
  };
};
