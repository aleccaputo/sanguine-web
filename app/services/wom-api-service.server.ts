import { MembershipWithPlayer, WOMClient } from '@wise-old-man/utils';
import { remember } from '@epic-web/remember';
import * as process from 'process';
import chalk from 'chalk';

// Price cache
let womMemberCache: MembershipWithPlayer[] = [];
let lastMemberFetch: number = 0;

// Cache durations
const WOM_MEMBER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const groupId = parseInt(process.env.WOM_GROUP_ID!, 10);

const client = remember('wom', () => {
  return new WOMClient({
    apiKey: process.env.WOM_API_KEY,
  });
});

// limit actually doesn't work for this endpoint. This is apparently by design
export const getCompetitions = async (limit?: number) => {
  try {
    const compettions = await client.groups.getGroupCompetitions(groupId, {
      limit: limit,
    });
    return compettions;
  } catch (e) {
    chalk['red'](e);
  }
};

export const getCompetitionById = async (id: number) => {
  const competition = await client.competitions.getCompetitionDetails(id);
  return competition;
};

export const getClanFromWom = async (id: number) => {
  const now = Date.now();
  if (now - lastMemberFetch > WOM_MEMBER_CACHE_DURATION || womMemberCache.length === 0) {
    const clan = await client.groups.getGroupDetails(id);
    womMemberCache = clan.memberships;
    lastMemberFetch = now;
    return clan.memberships;
  }
  else {
    console.log('wom member cache hit');
    return womMemberCache;
  }
};

