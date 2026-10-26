import { remember } from '@epic-web/remember';
import { createLogger } from './logger.server';

const log = createLogger('cache');

interface ICacheEntry<T> {
  data: T;
  fetchedAt: number;
  /** Fresh until here; after it the next read refetches. */
  expiresAt: number;
  /** Servable as a fallback until here when a refetch fails. */
  staleUntil: number;
  /**
   * Set when a refetch failed: the stale value is served without touching the
   * upstream until this instant, so an outage costs one call per interval, not
   * one per page view.
   */
  retryAt: number;
}

interface ICacheStore<T> {
  entries: Map<string, ICacheEntry<T>>;
  inflight: Map<string, Promise<T>>;
}

export interface ICachedFetcherOptions<T> {
  /**
   * How long a value is served before it is refetched. A function may size the
   * TTL from the value itself (a finished competition settles for a day; a live
   * one is re-read in minutes).
   */
  ttlMs: number | ((data: T) => number);
  /**
   * Keep the last good value when a refetch fails and serve it instead of the
   * error (logged). The value is served for this long past its expiry before the
   * error is finally surfaced. Defaults to one hour.
   */
  staleOnErrorMs?: number;
  /** How long to wait before retrying the upstream after a failed refetch. Default 30s. */
  retryAfterMs?: number;
  /** Upper bound on cached keys; the oldest are dropped first. Default 256. */
  maxEntries?: number;
}

const DEFAULT_STALE_ON_ERROR_MS = 60 * 60 * 1000;
const DEFAULT_RETRY_AFTER_MS = 30 * 1000;
const DEFAULT_MAX_ENTRIES = 256;

const resolveTtl = <T>(
  ttlMs: ICachedFetcherOptions<T>['ttlMs'],
  data: T,
): number => (typeof ttlMs === 'function' ? ttlMs(data) : ttlMs);

/** Makes room for `key`: drops entries past their stale window, then the oldest others. */
const prune = <T>(
  entries: Map<string, ICacheEntry<T>>,
  key: string,
  now: number,
  maxEntries: number,
) => {
  [...entries.entries()]
    .filter(([, entry]) => entry.staleUntil <= now)
    .forEach(([entryKey]) => entries.delete(entryKey));
  const growth = entries.has(key) ? 0 : 1;
  [...entries.entries()]
    .filter(([entryKey]) => entryKey !== key)
    .sort(([, a], [, b]) => a.fetchedAt - b.fetchedAt)
    .slice(0, Math.max(0, entries.size + growth - maxEntries))
    .forEach(([entryKey]) => entries.delete(entryKey));
};

/**
 * Wraps a keyed read of an external API in a process-wide cache: a value is
 * served until its TTL lapses, concurrent callers for one key share a single
 * in-flight request, and a failed refetch falls back to the last good value
 * (with a retry interval) rather than erroring, and re-requesting, on every
 * page view while the upstream is down.
 *
 * The store lives in `remember` under `name`, so dev-server HMR and duplicate
 * module instances never reset it (every reset is a fresh burst of upstream
 * calls). Names must be unique per fetcher.
 */
export const createCachedFetcher = <T>(
  name: string,
  fetcher: (key: string) => Promise<T>,
  options: ICachedFetcherOptions<T>,
) => {
  const staleOnErrorMs = options.staleOnErrorMs ?? DEFAULT_STALE_ON_ERROR_MS;
  const retryAfterMs = options.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const store = remember(
    `cachedFetcher:${name}`,
    (): ICacheStore<T> => ({ entries: new Map(), inflight: new Map() }),
  );

  const read = (key: string): Promise<T> => {
    const now = Date.now();
    const cached = store.entries.get(key);
    if (cached && (now < cached.expiresAt || now < cached.retryAt)) {
      // Hits are logged so the dashboard can compute a hit rate per cache.
      log.info({ kind: 'cache', name, key, result: 'hit' }, 'cache hit');
      return Promise.resolve(cached.data);
    }
    const pending = store.inflight.get(key);
    if (pending) return pending;

    const request = fetcher(key)
      .then(data => {
        const fetchedAt = Date.now();
        const expiresAt = fetchedAt + resolveTtl(options.ttlMs, data);
        prune(store.entries, key, fetchedAt, maxEntries);
        store.entries.set(key, {
          data,
          fetchedAt,
          expiresAt,
          staleUntil: expiresAt + staleOnErrorMs,
          retryAt: 0,
        });
        log.info(
          {
            kind: 'cache',
            name,
            key,
            result: 'miss',
            durationMs: fetchedAt - now,
            ttlMs: expiresAt - fetchedAt,
          },
          'cache miss (refetched)',
        );
        return data;
      })
      .catch((error: unknown) => {
        const stale = store.entries.get(key);
        const failedAt = Date.now();
        if (stale && failedAt < stale.staleUntil) {
          log.warn(
            { kind: 'cache', name, key, result: 'stale', err: error },
            'refetch failed; serving stale value',
          );
          store.entries.set(key, {
            ...stale,
            retryAt: failedAt + retryAfterMs,
          });
          return stale.data;
        }
        throw error;
      })
      .finally(() => {
        store.inflight.delete(key);
      });
    store.inflight.set(key, request);
    return request;
  };

  return Object.assign(read, {
    /** Drop every cached value and in-flight request (tests). */
    clear: () => {
      store.entries.clear();
      store.inflight.clear();
    },
  });
};
