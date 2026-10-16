/**
 * Races a promise against a fallback. Deferred loader sections must settle
 * before entry.server's 10s stream abort, or the client rejects them with
 * "Server timeout" and the page falls to the root error boundary; slow
 * upstreams get a fallback comfortably under that. A rejection also resolves
 * to the fallback.
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> =>
  Promise.race([
    promise.catch(() => fallback),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
