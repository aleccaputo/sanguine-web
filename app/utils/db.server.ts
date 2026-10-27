import { remember } from '@epic-web/remember';
import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger.server';

const log = createLogger('prisma');

/**
 * Fly suspends idle machines (`auto_stop_machines = "suspend"` in fly.toml), as soon as a
 * second after the last request. The snapshot restores the Mongo driver's pooled sockets, but
 * after a few minutes frozen the network path has dropped them, so queries written into them
 * hang until TCP gives up (~975s), holding pool slots while every later request queues behind
 * them (issue #54). The driver's `maxIdleTimeMS` can't catch this: the guest's monotonic clock
 * doesn't advance while suspended, so a socket used just before a 30 minute suspend still looks
 * a second idle. The wall clock does jump, so a 1s ticker notices the freeze as a `Date.now()`
 * gap and the next query drops the pool first; Prisma reconnects lazily.
 */
const TICK_MS = 1_000;
const SUSPEND_GAP_MS = 15_000;

export const prisma = remember('prisma', () => {
  // NOTE: if you change anything in this function you'll need to restart
  // the dev server to see your changes.

  // Queries slower than this are logged as `{ kind: 'db', durationMs, query }`
  // so the ops dashboard can rank them.
  const logThreshold = 150;

  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });
  client.$on('query', async e => {
    if (e.duration < logThreshold) return;
    log.warn(
      { kind: 'db', durationMs: e.duration, query: e.query },
      'slow query',
    );
  });
  client.$connect();

  const pool = {
    lastTick: Date.now(),
    suspendedMs: 0,
    reset: undefined as Promise<void> | undefined,
  };
  setInterval(() => {
    const now = Date.now();
    const gap = now - pool.lastTick - TICK_MS;
    if (gap > SUSPEND_GAP_MS) pool.suspendedMs = Math.max(pool.suspendedMs, gap);
    pool.lastTick = now;
  }, TICK_MS).unref();

  // The waking request can reach a query before the ticker's first post-resume tick,
  // so an overdue tick counts as a gap too.
  const resetIfResumed = (): Promise<void> | undefined => {
    if (pool.reset) return pool.reset;
    const overdueMs = Date.now() - pool.lastTick - TICK_MS;
    const suspendedMs = Math.max(
      pool.suspendedMs,
      overdueMs > SUSPEND_GAP_MS ? overdueMs : 0,
    );
    if (suspendedMs === 0) return undefined;

    pool.suspendedMs = 0;
    pool.lastTick = Date.now();
    log.info(
      { kind: 'db-resume', suspendedMs },
      'machine resumed, dropping stale connection pool',
    );
    pool.reset = client
      .$disconnect()
      .catch(error => log.warn({ err: error }, 'disconnect after resume failed'))
      .finally(() => {
        pool.reset = undefined;
      });
    return pool.reset;
  };

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        await resetIfResumed();
        return query(args);
      },
    },
  });
});
