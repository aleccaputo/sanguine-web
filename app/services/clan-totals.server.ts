import { getClanDropCountsByItem } from '~/data/points-audit';
import {
  computeClanTotalsFromCounts,
  type ClanTotals,
} from '~/data/points-audit/stats';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service.server';
import { createCachedFetcher } from '~/utils/cached-fetcher';
import type { OSRSItem } from '~/utils/osrs-item';

const TOTALS_TTL_MS = 5 * 60 * 1000;
const TOTALS_REVALIDATE_MS = 60 * 60 * 1000;

// Hero numbers for the home page. They move a few times a day, so a five minute
// TTL with background revalidation means a page view never waits on the
// aggregation once the process has served it once.
const clanTotalsFetcher = createCachedFetcher<ClanTotals>(
  'clanTotals',
  async () => {
    const counts = await getClanDropCountsByItem();
    const itemIds = counts
      .map(c => c.itemId)
      .filter((id): id is number => id != null);
    const items = await Promise.all(itemIds.map(id => fetchOSRSItem(id)));
    const itemMap = new Map<number, OSRSItem>();
    itemIds.forEach((id, i) => {
      const item = items[i];
      if (item) itemMap.set(id, item);
    });
    return computeClanTotalsFromCounts(counts, itemMap);
  },
  { ttlMs: TOTALS_TTL_MS, revalidateInBackgroundMs: TOTALS_REVALIDATE_MS },
);

/** Clan-wide drop count, GP and points across all automated drops. */
export const getClanTotals = (): Promise<ClanTotals> => clanTotalsFetcher('all');
