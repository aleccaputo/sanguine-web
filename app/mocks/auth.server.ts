import { redirect } from '@remix-run/node';
import type { ISessionUser } from '../services/auth.server';

// MOCK_MODE stand-in for Discord OAuth: every visitor is a logged-in staff member.

const mockUser: ISessionUser = {
  discordId: '111111111111111111',
  username: 'MockAdmin',
  avatarUrl: null,
  isStaff: true,
};

export const requireStaff = async (): Promise<ISessionUser> => mockUser;

export const getSessionUser = async (): Promise<ISessionUser | null> => mockUser;

export const authenticator = {
  authenticate: async (): Promise<never> => {
    throw redirect('/admin');
  },
  isAuthenticated: async (): Promise<ISessionUser> => mockUser,
  logout: async (): Promise<never> => {
    throw redirect('/');
  },
};
