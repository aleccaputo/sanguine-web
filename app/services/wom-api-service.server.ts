import {
  CompetitionDetailsResponse,
  CompetitionResponse,
  GroupDetailsResponse,
  Metric,
  WOMClient,
} from '@wise-old-man/utils';
import { remember } from '@epic-web/remember';
import * as process from 'process';
import { createCachedFetcher } from '~/utils/cached-fetcher';

// v4 of @wise-old-man/utils no longer exports a `MembershipWithPlayer` type, so we derive the
// membership-with-player shape from the group details response the client returns.
export type MembershipWithPlayer = GroupDetailsResponse['memberships'][number];

// Sanguine's WOM group. Overridable for pointing at a test group; the routes
// all use this default rather than repeating the id.
const groupId = parseInt(process.env.WOM_GROUP_ID ?? '18435', 10);

const client = remember('wom', () => {
  return new WOMClient({
    apiKey: process.env.WOM_API_KEY,
    userAgent: 'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
  });
});

// Every WOM read below goes through `createCachedFetcher`: one in-flight request per key,
// a TTL before the next read, and the last good value served while WOM is erroring. WOM is
// a volunteer-run API that has asked us (politely, by DM) not to hammer it; these caches are
// the only thing between a page view and an upstream call, so every new read must get one.
//
// Nothing here changes faster than the bot's own update cadence, so the TTLs lean long.
const COMPETITION_LIST_TTL_MS = 10 * 60 * 1000;
const COMPETITION_LIVE_TTL_MS = 5 * 60 * 1000;
const COMPETITION_SETTLED_TTL_MS = 24 * 60 * 60 * 1000;
// A competition that ended more than a day ago can't move any more (the final update has
// landed); only title/metric edits would show, and a day's lag on those is fine.
const COMPETITION_SETTLE_MS = 24 * 60 * 60 * 1000;
const GROUP_DETAILS_TTL_MS = 10 * 60 * 1000;

const competitionListFetcher = createCachedFetcher(
  'womCompetitions',
  // `limit` doesn't affect this endpoint (apparently by design), so one entry serves everyone.
  () => client.groups.getGroupCompetitions(groupId),
  { ttlMs: COMPETITION_LIST_TTL_MS },
);

/**
 * The clan group's competition list. Resolves to undefined when WOM is unreachable and no
 * stale copy exists, so listings degrade to the special competitions alone.
 */
export const getCompetitions = async () => {
  try {
    const competitions: CompetitionResponse[] = await competitionListFetcher(
      String(groupId),
    );
    return competitions;
  } catch (error) {
    console.error('WOM group competitions request failed', error);
    return undefined;
  }
};

const competitionDetailsFetcher = createCachedFetcher(
  'womCompetitionDetails',
  (id: string) => client.competitions.getCompetitionDetails(Number(id)),
  {
    ttlMs: (competition: CompetitionDetailsResponse) =>
      new Date(competition.endsAt).getTime() <=
      Date.now() - COMPETITION_SETTLE_MS
        ? COMPETITION_SETTLED_TTL_MS
        : COMPETITION_LIVE_TTL_MS,
  },
);

/** One competition with its participations. Throws when WOM can't serve it at all. */
export const getCompetitionById = (
  id: number,
): Promise<CompetitionDetailsResponse> => competitionDetailsFetcher(String(id));

/**
 * `getCompetitionById` for listings that should drop an unavailable competition rather
 * than fail: resolves to undefined and logs, so a deleted or mistyped special id is
 * visible in the server log instead of silently vanishing from the page.
 */
export const getCompetitionByIdOrNull = (
  id: number,
): Promise<CompetitionDetailsResponse | undefined> =>
  getCompetitionById(id).catch((error: unknown) => {
    console.error(`WOM competition ${id} request failed`, error);
    return undefined;
  });

const groupMembershipsFetcher = createCachedFetcher(
  'womGroupMemberships',
  (id: string) =>
    client.groups.getGroupDetails(Number(id)).then(group => group.memberships),
  { ttlMs: GROUP_DETAILS_TTL_MS },
);

/** Every membership (with player) in the clan's WOM group. */
export const getClanFromWom = (
  id: number = groupId,
): Promise<MembershipWithPlayer[]> => groupMembershipsFetcher(String(id));

// ---- Group gains over a window (clan insights) ----

/** One member's movement on a metric between two snapshots. */
export interface IMemberGain {
  username: string;
  displayName: string;
  start: number;
  end: number;
  gained: number;
}

interface IGainsCacheEntry {
  fetchedAt: number;
  /** When this entry stops being served; Infinity for a settled window. */
  expiresAt: number;
  /** The read itself, so concurrent callers for one window share a single WOM walk. */
  rows: Promise<IMemberGain[]>;
}

// WOM's documented page size ceiling for group gains. In practice the endpoint ignores
// limit/offset when a start/end date is given and returns the whole group in one response
// (verified 2026-09-27: 362 rows for every offset), so the walk below must stop on its own:
// it ends on a short page, on a page it has already seen, or at a hard page cap. Never assume a
// full page means there is more — that assumption looped forever against WOM once.
const GAINS_PAGE_SIZE = 50;
const GAINS_MAX_PAGES = 20;
// A window whose end is at least this far in the past can't change any more (the bot's daily
// update after it has already landed), so its rows are kept for the life of the process.
// Anything more recent is re-read after a short TTL. Both exist to keep the admin insights page
// from re-walking the group on every view — WOM is a volunteer project and we don't hammer it.
const GAINS_SETTLE_MS = 24 * 60 * 60 * 1000;
const GAINS_LIVE_TTL_MS = 15 * 60 * 1000;
// Live keys embed their 15-minute bucket, so every bucket adds keys that will never be read
// again; expired entries are dropped on each write, and the total is capped, oldest first.
const GAINS_MAX_ENTRIES = 64;
const gainsCache = remember(
  'womGains',
  () => new Map<string, IGainsCacheEntry>(),
);

const toMemberGain = (
  row: Awaited<ReturnType<typeof client.groups.getGroupGains>>[number],
): IMemberGain => ({
  username: row.player.username,
  displayName: row.player.displayName,
  start: row.data.start,
  end: row.data.end,
  gained: row.data.gained,
});

const fetchGainsPages = async (
  metric: Metric,
  startDate: Date,
  endDate: Date,
  pageIndex: number,
  seen: ReadonlyMap<string, IMemberGain>,
): Promise<ReadonlyMap<string, IMemberGain>> => {
  const page = await client.groups.getGroupGains(
    groupId,
    { metric, startDate, endDate },
    { limit: GAINS_PAGE_SIZE, offset: pageIndex * GAINS_PAGE_SIZE },
  );
  const fresh = page.filter(row => !seen.has(row.player.username));
  const merged = new Map([
    ...seen,
    ...fresh.map(row => [row.player.username, toMemberGain(row)] as const),
  ]);
  // A page that isn't exactly the requested size is either the last one (short) or proof the
  // endpoint ignored pagination and sent everything (oversized) — either way, stop.
  const exhausted =
    page.length !== GAINS_PAGE_SIZE ||
    fresh.length === 0 ||
    pageIndex + 1 >= GAINS_MAX_PAGES;
  return exhausted
    ? merged
    : fetchGainsPages(metric, startDate, endDate, pageIndex + 1, merged);
};

/**
 * Every group member's delta on one metric between two instants, walking WOM's pages in
 * sequence. Settled windows are cached for the process lifetime; live ones for a few minutes.
 */
export const getGroupGainsForWindow = async (
  metric: Metric,
  startDate: Date,
  endDate: Date,
): Promise<IMemberGain[]> => {
  const key = `${metric}|${startDate.toISOString()}|${endDate.toISOString()}`;
  const now = Date.now();
  const cached = gainsCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached.rows;
  }
  const settled = endDate.getTime() <= now - GAINS_SETTLE_MS;
  const rows = fetchGainsPages(metric, startDate, endDate, 0, new Map()).then(
    pages => [...pages.values()],
  );
  // A failed read must not be served from cache; drop it so the next caller retries.
  rows.catch(() => gainsCache.delete(key));
  pruneGainsCache(now);
  gainsCache.set(key, {
    fetchedAt: now,
    expiresAt: settled ? Infinity : now + GAINS_LIVE_TTL_MS,
    rows,
  });
  return rows;
};

/** Drops expired entries, then the oldest beyond the cap, before a new entry goes in. */
const pruneGainsCache = (now: number) => {
  const expired = [...gainsCache.entries()]
    .filter(([, entry]) => entry.expiresAt <= now)
    .map(([key]) => key);
  expired.forEach(key => gainsCache.delete(key));
  const overflow = [...gainsCache.entries()]
    .sort(([, a], [, b]) => a.fetchedAt - b.fetchedAt)
    .slice(0, Math.max(0, gainsCache.size - (GAINS_MAX_ENTRIES - 1)))
    .map(([key]) => key);
  overflow.forEach(key => gainsCache.delete(key));
};
