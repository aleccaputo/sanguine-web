import { redirect } from '@remix-run/node';
import type { ISessionUser } from '../services/auth.server';

// MOCK_MODE stand-in for Discord OAuth: every visitor is a logged-in staff member.

// Keep the exported surface in sync with the real module (login.tsx imports this).
export const NOT_STAFF_MESSAGE = 'not-staff';

const mockUser: ISessionUser = {
  discordId: '111111111111111111',
  username: 'MockAdmin',
  avatarUrl: null,
  isStaff: true,
};

export const requireStaff = async (): Promise<ISessionUser> => mockUser;

export const getSessionUser = async (): Promise<ISessionUser | null> => mockUser;

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
