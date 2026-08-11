import * as process from 'process';
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import { Authenticator } from 'remix-auth';
import { DiscordStrategy } from 'remix-auth-discord';
import { getGuildMember } from '~/services/discord-admin-service.server';

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

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__sanguine_admin',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET ?? 'dev-only-insecure-secret'],
    secure: process.env.NODE_ENV === 'production',
  },
});

const staffRoleIds = [
  process.env.ADMIN_ROLE_ID,
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
      const member = await getGuildMember(profile.id);
      const isStaff =
        !!member && member.roles.some(role => staffRoleIds.includes(role));
      const avatarHash = profile.__json.avatar;
      return {
        discordId: profile.id,
        username: member?.nick ?? profile.displayName,
        avatarUrl: avatarHash
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${avatarHash}.png?size=64`
          : null,
        isStaff,
      };
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
    throw redirect('/login?denied=1');
  }
  return user;
};

export const getSessionUser = (request: Request): Promise<ISessionUser | null> =>
  authenticator.isAuthenticated(request);
