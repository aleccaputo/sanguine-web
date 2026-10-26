import { remember } from '@epic-web/remember';
import pino from 'pino';

/**
 * Structured JSON logging (pino) so Fly log lines carry level/service/fields the
 * ops dashboard can key off. Same base shape as the clan-manager bot:
 * `{ level, time, app, env, service, msg, ...fields }`, errors under `err`.
 *
 * Conventions the dashboard understands:
 *  - `{ kind: 'outbound', provider, op, durationMs, status }` — see utils/outbound.server.ts
 *  - `{ kind: 'cache', name, result: 'hit' | 'miss' | 'stale' }` — see utils/cached-fetcher.ts
 *  - `{ kind: 'db', durationMs, query }` — slow Prisma queries
 */
const isProduction = process.env.NODE_ENV === 'production';

export const logger = remember('logger', () =>
  pino({
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    base: { app: 'sanguine-web', env: process.env.NODE_ENV ?? 'development' },
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname,app,env',
            },
          },
        }),
  }),
);

export const createLogger = (service: string) => logger.child({ service });
