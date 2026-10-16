import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCachedFetcher } from './cached-fetcher';

describe('createCachedFetcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('serves the cached value until the ttl lapses', async () => {
    const fetcher = vi.fn(async (key: string) => `${key}-value`);
    const read = createCachedFetcher('test-ttl', fetcher, { ttlMs: 1000 });
    read.clear();

    expect(await read('a')).toBe('a-value');
    expect(await read('a')).toBe('a-value');
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001);
    expect(await read('a')).toBe('a-value');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetcher = vi.fn(async (key: string) => `${key}-value`);
    const read = createCachedFetcher('test-inflight', fetcher, {
      ttlMs: 1000,
    });
    read.clear();

    const results = await Promise.all([read('a'), read('a'), read('b')]);
    expect(results).toEqual(['a-value', 'a-value', 'b-value']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('sizes the ttl from the value when given a function', async () => {
    const fetcher = vi.fn(async (key: string) => ({ settled: key === 'old' }));
    const read = createCachedFetcher('test-ttl-fn', fetcher, {
      ttlMs: data => (data.settled ? 10_000 : 100),
    });
    read.clear();

    await read('old');
    await read('live');
    vi.advanceTimersByTime(500);
    await read('old');
    await read('live');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('serves the last good value when a refetch fails', async () => {
    const fetcher = vi
      .fn<(key: string) => Promise<string>>()
      .mockResolvedValueOnce('fresh')
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce('fresh again');
    const read = createCachedFetcher('test-stale', fetcher, {
      ttlMs: 1000,
      staleOnErrorMs: 5000,
      retryAfterMs: 500,
    });
    read.clear();

    expect(await read('a')).toBe('fresh');
    vi.advanceTimersByTime(1001);
    expect(await read('a')).toBe('fresh');
    expect(console.warn).toHaveBeenCalledTimes(1);
    // Until the retry interval passes, the stale value is served without another upstream call.
    expect(await read('a')).toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(501);
    expect(await read('a')).toBe('fresh again');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('surfaces the error once the stale grace period has passed', async () => {
    const fetcher = vi
      .fn<(key: string) => Promise<string>>()
      .mockResolvedValueOnce('fresh')
      .mockRejectedValue(new Error('upstream down'));
    const read = createCachedFetcher('test-stale-expired', fetcher, {
      ttlMs: 1000,
      staleOnErrorMs: 5000,
    });
    read.clear();

    await read('a');
    vi.advanceTimersByTime(6001);
    await expect(read('a')).rejects.toThrow('upstream down');
  });

  it('does not cache a failed first read', async () => {
    const fetcher = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce('fresh');
    const read = createCachedFetcher('test-first-error', fetcher, {
      ttlMs: 1000,
    });
    read.clear();

    await expect(read('a')).rejects.toThrow('upstream down');
    expect(await read('a')).toBe('fresh');
  });

  it('drops the oldest keys beyond the cap', async () => {
    const fetcher = vi.fn(async (key: string) => key);
    const read = createCachedFetcher('test-cap', fetcher, {
      ttlMs: 60_000,
      maxEntries: 2,
    });
    read.clear();

    await read('a');
    vi.advanceTimersByTime(1);
    await read('b');
    vi.advanceTimersByTime(1);
    await read('c');
    await read('b');
    await read('c');
    expect(fetcher).toHaveBeenCalledTimes(3);
    await read('a');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('does not evict a neighbour when refetching a key already at the cap', async () => {
    const fetcher = vi.fn(async (key: string) => key);
    const read = createCachedFetcher('test-cap-refetch', fetcher, {
      ttlMs: key => (key === 'settled' ? 60_000 : 100),
      maxEntries: 2,
    });
    read.clear();

    await read('settled');
    vi.advanceTimersByTime(1);
    await read('live');
    vi.advanceTimersByTime(200);
    await read('live');
    await read('settled');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
