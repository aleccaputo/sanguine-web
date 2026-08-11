/**
 * Structured audit trail for the admin portal: who signed in, who was denied,
 * and which admin actions were attempted. One JSON line per event to stdout —
 * morgan's request lines carry no user identity, and Fly captures stdout, so
 * this is greppable in `fly logs` without any extra infrastructure.
 */
export const audit = (
  event:
    | 'auth.login'
    | 'auth.login_failed'
    | 'auth.denied'
    | 'auth.logout'
    | 'admin.action',
  details: Record<string, unknown>,
): void => {
  console.log(
    JSON.stringify({ audit: event, ts: new Date().toISOString(), ...details }),
  );
};
