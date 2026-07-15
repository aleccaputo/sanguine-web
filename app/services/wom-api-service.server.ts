import {
  CompetitionResponse,
  GroupDetailsResponse,
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
