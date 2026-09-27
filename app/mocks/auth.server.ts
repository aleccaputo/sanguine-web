import { redirect } from '@remix-run/node';
import type { ISessionUser } from '../services/auth.server';

// MOCK_MODE stand-in for Discord OAuth: every visitor is a logged-in staff member, and a
// moderator unless MOCK_EVENT_TEAM=1 (which exercises the moderator-only gate).

// Keep the exported surface in sync with the real module (login.tsx imports this).
export const NOT_STAFF_MESSAGE = 'not-staff';

const mockUser: ISessionUser = {
  discordId: '111111111111111111',
  username: 'MockAdmin',
  avatarUrl: null,
  isStaff: true,
  isModerator: process.env.MOCK_EVENT_TEAM !== '1',
};

export const requireStaff = async (): Promise<ISessionUser> => mockUser;

export const requireModerator = async (): Promise<ISessionUser> => {
  if (!mockUser.isModerator) {
    throw redirect('/admin?denied=moderator');
  }
  return mockUser;
};

export const getSessionUser = async (): Promise<ISessionUser | null> =>
  mockUser;

export const authenticator = {
  sessionErrorKey: 'auth:error',
  authenticate: async (): Promise<never> => {
    throw redirect('/admin');
  },
  isAuthenticated: async (): Promise<ISessionUser> => mockUser,
  logout: async (): Promise<never> => {
    throw redirect('/');
  },
};

export const sessionStorage = {
  getSession: async () => ({ get: (): undefined => undefined }),
  commitSession: async () => '',
};
