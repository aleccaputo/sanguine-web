import { MOCK_USERS, findMockUser } from '~/mocks/fixtures.server';

export interface ISanguineUser {
  discordId: string;
  points: number;
  clanPoints: number;
  joined: string;
}

export const getUserById = async (id: string): Promise<ISanguineUser> => {
  const user = findMockUser(id);
  if (!user) {
    throw new Error(`Unable to map user with ID ${id}, missing a property`);
  }
  return {
    discordId: user.discordId,
    joined: user.joined,
    points: user.points,
    clanPoints: user.clanPoints,
  };
};

export const getAllUsers = async (): Promise<ISanguineUser[]> =>
  MOCK_USERS.map(u => ({
    discordId: u.discordId,
    points: u.points,
    clanPoints: u.clanPoints,
    joined: u.joined,
  }));

export interface ISanguineUserAlt {
  id: string;
  altName: string;
}

export const getUserAlts = async (
  discordId: string,
): Promise<ISanguineUserAlt[]> => {
  const user = findMockUser(discordId);
  return user?.alts.map(a => ({ id: a.id, altName: a.altName })) ?? [];
};

export const getAllUserAlts = async (): Promise<
  (ISanguineUserAlt & { discordId: string })[]
> =>
  MOCK_USERS.flatMap(u =>
    u.alts.map(a => ({ id: a.id, altName: a.altName, discordId: u.discordId })),
  );
