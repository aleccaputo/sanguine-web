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
  rows: IMemberGain[];
}

// WOM's page size ceiling for group gains.
const GAINS_PAGE_SIZE = 50;
// A window whose end is at least this far in the past can't change any more (the bot's daily
// update after it has already landed), so its rows are kept for the life of the process.
// Anything more recent is re-read after a short TTL. Both exist to keep the admin insights page
// from re-walking the group on every view — WOM is a volunteer project and we don't hammer it.
const GAINS_SETTLE_MS = 24 * 60 * 60 * 1000;
const GAINS_LIVE_TTL_MS = 15 * 60 * 1000;
const gainsCache = remember(
  'womGains',
  () => new Map<string, IGainsCacheEntry>(),
);

const fetchGainsPage = async (
  metric: Metric,
  startDate: Date,
  endDate: Date,
  offset: number,
): Promise<IMemberGain[]> => {
  const page = await client.groups.getGroupGains(
    groupId,
    { metric, startDate, endDate },
    { limit: GAINS_PAGE_SIZE, offset },
  );
  const rows = page.map(row => ({
    username: row.player.username,
    displayName: row.player.displayName,
    start: row.data.start,
    end: row.data.end,
    gained: row.data.gained,
  }));
  // Pages come back sorted by gain, so once a page is short there's nothing after it.
  return page.length < GAINS_PAGE_SIZE
    ? rows
    : [
        ...rows,
        ...(await fetchGainsPage(
          metric,
          startDate,
          endDate,
          offset + GAINS_PAGE_SIZE,
        )),
      ];
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
  const settled = endDate.getTime() <= now - GAINS_SETTLE_MS;
  const cached = gainsCache.get(key);
  if (cached && (settled || now - cached.fetchedAt < GAINS_LIVE_TTL_MS)) {
    return cached.rows;
  }
  const rows = await fetchGainsPage(metric, startDate, endDate, 0);
  gainsCache.set(key, { fetchedAt: now, rows });
  return rows;
};
