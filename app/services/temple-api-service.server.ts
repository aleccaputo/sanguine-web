import * as process from 'process';
import type {
  ITempleClogCategories,
  ITempleGroupClog,
  ITempleGroupRecentItem,
  ITempleRecentItem,
} from '~/utils/collection-log';

/**
 * TempleOSRS public API (https://templeosrs.com/api_doc.php). Read endpoints
 * need no key. Collection log data only exists for members who sync via the
 * TempleOSRS RuneLite plugin, so treat every lookup as opt-in coverage.
 * Shapes and pure helpers live in ~/utils/collection-log — this module owns
 * only the I/O (and is swapped for app/mocks/temple-api-service.server.ts
 * under MOCK_MODE).
 */
const TEMPLE_BASE_URL = 'https://templeosrs.com/api';
const TEMPLE_HEADERS = {
  'User-Agent': 'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
};

const templeGroupId = process.env.TEMPLE_GROUP_ID ?? '3634';

export const TEMPLE_GROUP_URL = `https://templeosrs.com/groups/overview.php?id=${templeGroupId}`;

// Temple reports errors as 200s with an error envelope (e.g. code 402 for a
// player who has never synced).
interface ITempleErrorEnvelope {
  error?: { Code: number; Message: string };
}

// Callers degrade by catching, which only helps once the promise settles — a
// hung connection must abort rather than hold every awaiting loader open.
const TEMPLE_TIMEOUT_MS = 8_000;

const fetchTempleJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${TEMPLE_BASE_URL}${path}`, {
    headers: TEMPLE_HEADERS,
    signal: AbortSignal.timeout(TEMPLE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`TempleOSRS request failed (${response.status}): ${path}`);
  }
  const body: T & ITempleErrorEnvelope = await response.json();
  if (body.error) {
    throw new Error(
      `TempleOSRS error ${body.error.Code}: ${body.error.Message}`,
    );
  }
  return body;
};

interface ICacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Module-level cache with in-flight deduplication, keyed for per-player use. */
const createCachedFetcher = <T>(
  fetcher: (key: string) => Promise<T>,
  durationMs: number,
) => {
  const cache = new Map<string, ICacheEntry<T>>();
  const inflight = new Map<string, Promise<T>>();
  return (key: string): Promise<T> => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < durationMs) {
      return Promise.resolve(cached.data);
    }
    const pending = inflight.get(key);
    if (pending) return pending;
    const request = fetcher(key)
      .then(data => {
        cache.set(key, { data, timestamp: Date.now() });
        return data;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, request);
    return request;
  };
};

const GROUP_CLOG_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (~165KB payload)
const RECENT_ITEMS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const STATIC_LIST_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const groupClogFetcher = createCachedFetcher(
  () =>
    fetchTempleJson<{ data: ITempleGroupClog }>(
      `/collection-log/group_collection_log.php?group=${templeGroupId}&categories=all`,
    ).then(body => body.data),
  GROUP_CLOG_CACHE_DURATION,
);

/** Every synced member's owned item ids plus per-member log totals. */
export const getGroupCollectionLog = (): Promise<ITempleGroupClog> =>
  groupClogFetcher('group');

const groupRecentItemsFetcher = createCachedFetcher(
  () =>
    fetchTempleJson<{ data: ITempleGroupRecentItem[] }>(
      `/collection-log/group_recent_items.php?group=${templeGroupId}&count=30&onlynotable=1`,
    ).then(body => body.data),
  RECENT_ITEMS_CACHE_DURATION,
);

/** The clan's most recent notable unlocks (pets, rare clue items, …). */
export const getGroupRecentNotableItems = (): Promise<
  ITempleGroupRecentItem[]
> => groupRecentItemsFetcher('group');

const playerRecentItemsFetcher = createCachedFetcher(
  player =>
    fetchTempleJson<{ data: ITempleRecentItem[] }>(
      `/collection-log/player_recent_items.php?player=${encodeURIComponent(player)}&count=25`,
    ).then(body => body.data),
  RECENT_ITEMS_CACHE_DURATION,
);

/**
 * A player's most recent unlocks. Resolves to [] for players Temple doesn't
 * know or who have never synced — only the caller knows whether that's worth
 * mentioning.
 */
export const getPlayerRecentItems = (
  player: string,
): Promise<ITempleRecentItem[]> =>
  playerRecentItemsFetcher(player).catch(() => []);

const clogCategoriesFetcher = createCachedFetcher(
  () =>
    fetchTempleJson<ITempleClogCategories>('/collection-log/categories.php'),
  STATIC_LIST_CACHE_DURATION,
);

/** All collection log categories and the item ids they contain. */
export const getClogCategories = (): Promise<ITempleClogCategories> =>
  clogCategoriesFetcher('categories');

const clogItemNamesFetcher = createCachedFetcher(
  () =>
    fetchTempleJson<{ items: Record<string, string> }>(
      '/collection-log/items.php',
    ).then(body => body.items),
  STATIC_LIST_CACHE_DURATION,
);

/** Item id to name for every tracked collection log item. */
export const getClogItemNames = (): Promise<Record<string, string>> =>
  clogItemNamesFetcher('items');
