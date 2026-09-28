import {
  CompetitionResponse,
  GroupDetailsResponse,
  Metric,
  WOMClient,
} from '@wise-old-man/utils';
import { remember } from '@epic-web/remember';
import * as process from 'process';
import chalk from 'chalk';

// v4 of @wise-old-man/utils no longer exports a `MembershipWithPlayer` type, so we derive the
// membership-with-player shape from the group details response the client returns.
export type MembershipWithPlayer = GroupDetailsResponse['memberships'][number];

// Price cache
let womMemberCache: MembershipWithPlayer[] = [];
let lastMemberFetch: number = 0;

// Cache durations
const WOM_MEMBER_CACHE_DURATION = 1 * 60 * 1000; // 1 minutes

// Sanguine's WOM group. Overridable for pointing at a test group; the routes
// all use this default rather than repeating the id.
const groupId = parseInt(process.env.WOM_GROUP_ID ?? '18435', 10);

const client = remember('wom', () => {
  return new WOMClient({
    apiKey: process.env.WOM_API_KEY,
    userAgent: 'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
  });
});

// Competition list cache — user profiles join audit rows against this on every view, so
// don't hit WOM each time. `limit` doesn't affect the endpoint (see note below), so one
// shared cache entry is safe.
let womCompCache: CompetitionResponse[] | null = null;
let lastCompFetch = 0;
const WOM_COMP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// limit actually doesn't work for this endpoint. This is apparently by design
export const getCompetitions = async (limit?: number) => {
  const now = Date.now();
  if (womCompCache !== null && now - lastCompFetch < WOM_COMP_CACHE_DURATION) {
    return womCompCache;
  }
  try {
    const compettions = await client.groups.getGroupCompetitions(groupId, {
      limit: limit,
    });
    womCompCache = compettions;
    lastCompFetch = now;
    return compettions;
  } catch (e) {
    chalk['red'](e);
  }
};

export const getCompetitionById = async (id: number) => {
  const competition = await client.competitions.getCompetitionDetails(id);
  return competition;
};

export const getClanFromWom = async (id: number = groupId) => {
  const now = Date.now();
  if (
    lastMemberFetch !== null &&
    now - WOM_MEMBER_CACHE_DURATION > lastMemberFetch
  ) {
    const clan = await client.groups.getGroupDetails(id);
    womMemberCache = clan.memberships;
    lastMemberFetch = now;
    return clan.memberships;
  } else {
    console.info('wom member cache hit');
    return womMemberCache;
  }
};

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
