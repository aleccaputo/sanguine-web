import { MOCK_USERS, findMockUser } from '~/mocks/fixtures.server';

export const getNicknameById = async (discordId: string) => {
  const user = findMockUser(discordId);
  if (!user) return null;
  return { discordId: user.discordId, nickname: user.nickname };
};

export const getNicknames = async () =>
  MOCK_USERS.map(u => ({ discordId: u.discordId, nickname: u.nickname }));
