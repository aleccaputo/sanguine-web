import { createLogger } from './logger.server';

const log = createLogger('outbound');

/**
 * Wraps a call to a third-party service (WOM, TempleOSRS, OSRS Wiki, Discord
 * REST, the events API…) and emits one structured line per call:
 *
 *   { kind: 'outbound', provider, op, durationMs, status: 'ok' | 'error', statusCode? }
 *
 * The ops dashboard derives per-provider latency and error rates from these.
 * Errors are re-thrown untouched; callers keep their own handling.
 */
export const trackOutbound = async <T>(
  provider: string,
  op: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
): Promise<T> => {
  const start = Date.now();
  try {
    const result = await fn();
    log.info(
      {
        kind: 'outbound',
        provider,
        op,
        durationMs: Date.now() - start,
        status: 'ok',
        ...meta,
      },
      'outbound call',
    );
    return result;
  } catch (e) {
    log.warn(
      {
        kind: 'outbound',
        provider,
        op,
        durationMs: Date.now() - start,
        status: 'error',
        statusCode: statusCodeOf(e),
        errMessage: (e as Error)?.message,
        ...meta,
      },
      'outbound call failed',
    );
    throw e;
  }
};

/** HTTP status off the error shapes our clients throw (WOM client, fetch wrappers). */
const statusCodeOf = (e: unknown): number | undefined => {
  const err = e as { statusCode?: number; status?: number } | null;
  const candidate = err?.statusCode ?? err?.status;
  return typeof candidate === 'number' ? candidate : undefined;
};

/** Attach a status code to a thrown Error so trackOutbound can report it. */
export const httpError = (message: string, status: number): Error =>
  Object.assign(new Error(message), { statusCode: status });
