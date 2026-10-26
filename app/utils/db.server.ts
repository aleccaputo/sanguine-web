import { remember } from '@epic-web/remember';
import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger.server';

const log = createLogger('prisma');

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
  return client;
});
