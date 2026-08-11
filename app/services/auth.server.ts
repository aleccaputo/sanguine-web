import * as process from 'process';
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import { Authenticator } from 'remix-auth';
import { DiscordStrategy } from 'remix-auth-discord';
import { getGuildMember } from '~/services/discord-admin-service.server';
import { audit } from '~/services/audit.server';

/**
 * Discord OAuth for the admin portal. Anyone can complete the login; authorization
 * is the staff-role check (the same roles the events bot honors), stamped into the
 * session at login time. requireStaff gates every /admin loader and action.
 */
export interface ISessionUser {
  discordId: string;
  username: string;
  avatarUrl: string | null;
  isStaff: boolean;
}

// Same posture as the events API's token check: refuse to boot in production rather
// than sign staff sessions with a publicly known constant anyone could forge.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production');
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__sanguine_admin',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret ?? 'dev-only-insecure-secret'],
    secure: process.env.NODE_ENV === 'production',
    // Also bounds how long a revoked staff role keeps portal access, since isStaff is
    // stamped into the session at login.
    maxAge: 60 * 60 * 24 * 7,
  },
});

// Any of these roles counts as event staff; unset vars are ignored.
const staffRoleIds = [
  process.env.ADMIN_ROLE_ID,
  process.env.MOD_ROLE_ID,
  process.env.OWNER_ROLE_ID,
  process.env.EVENT_TEAM_ROLE_ID,
].filter((id): id is string => !!id);

export const authenticator = new Authenticator<ISessionUser>(sessionStorage);

authenticator.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      callbackURL:
        process.env.DISCORD_CALLBACK_URL ??
        'http://localhost:5173/auth/discord/callback',
      scope: ['identify'],
    },
    async ({ profile }): Promise<ISessionUser> => {
      try {
        const member = await getGuildMember(profile.id);
        const isStaff =
          !!member && member.roles.some(role => staffRoleIds.includes(role));
        const username = member?.nick ?? profile.displayName;
        const avatarHash = profile.__json.avatar;
        audit('auth.login', { discordId: profile.id, username, isStaff });
        return {
          discordId: profile.id,
          username,
          avatarUrl: avatarHash
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${avatarHash}.png?size=64`
            : null,
          isStaff,
        };
      } catch (error) {
        // remix-auth turns this into a failureRedirect; make sure the real cause
        // also lands in the server log.
        audit('auth.login_failed', {
          discordId: profile.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  ),
);

/** The logged-in staff member, or a redirect to /login (with ?denied for non-staff). */
export const requireStaff = async (request: Request): Promise<ISessionUser> => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    throw redirect('/login');
  }
  if (!user.isStaff) {
    // A signed-in non-staff account reaching for /admin is worth an audit line;
    // anonymous visitors bounced to /login are just traffic.
    audit('auth.denied', {
      discordId: user.discordId,
      username: user.username,
      path: new URL(request.url).pathname,
    });
    throw redirect('/login?denied=1');
  }
  return user;
};

export const getSessionUser = (request: Request): Promise<ISessionUser | null> =>
  authenticator.isAuthenticated(request);
