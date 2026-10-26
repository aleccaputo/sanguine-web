import { createLogger } from '~/utils/logger.server';

const log = createLogger('audit');

/**
 * Structured audit trail for the admin portal: who signed in, who was denied,
 * and which admin actions were attempted. One JSON line per event to stdout —
 * request logs carry no user identity, and Fly captures stdout, so this is
 * greppable in `fly logs` (and the ops dashboard) without extra infrastructure.
 */
export const audit = (
  event:
    | 'auth.login'
    | 'auth.login_failed'
    | 'auth.denied'
    | 'auth.stale_session'
    | 'auth.logout'
    | 'admin.action',
  details: Record<string, unknown>,
): void => {
  log.info({ kind: 'audit', audit: event, ...details }, event);
};
