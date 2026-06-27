import { getAllUsers, getUserById, ISanguineUser } from '~/data/user';
import {
  getNicknameById,
  getNicknames,
  getNicknamesByDiscordIds,
} from '~/data/nicknames';

export interface ISanguineUserWithNickname extends ISanguineUser {
  nickname?: string;
}

// Nicknames are stored with a trailing "[points]" suffix (e.g. "Doc [1234]"); strip it for display.
export const cleanNickname = (nickname: string): string =>
  nickname.includes('[') ? nickname.split('[')[0].trim() : nickname;

export const getUsersWithNicknames = async (): Promise<
  ISanguineUserWithNickname[]
> => {
  const users = await getAllUsers();
  const nicknames = await getNicknames();
  // this is probably way too slow, just fetch the whole list
  const usersWithNicknames = users.map(user => {
    try {
      const nicknameData = nicknames.find(x => x.discordId === user.discordId);
      if (!nicknameData?.nickname) {
        return user;
      }
      return {
        ...user,
        nickname: cleanNickname(nicknameData.nickname),
      };
    } catch (e) {
      return user;
    }
  });

  return usersWithNicknames;
};

export const getUserWithNickname = async (
  id: string,
): Promise<ISanguineUserWithNickname> => {
  const user = await getUserById(id);
  const nicknameData = await getNicknameById(id);
  if (!nicknameData?.nickname) {
    return { ...user };
  }

  return {
    ...user,
    nickname: cleanNickname(nicknameData.nickname),
  };
};

// Targeted discordId -> cleaned-nickname lookup for a known set of members. Cheaper than scanning
// every user when only a handful of names are needed (e.g. resolving a PB roster). Returns {} for
// an empty id list without touching the database.
export const getNicknameMapByDiscordIds = async (
  discordIds: string[],
): Promise<Record<string, string>> => {
  if (discordIds.length === 0) {
    return {};
  }
  const nicknames = await getNicknamesByDiscordIds(discordIds);
  return Object.fromEntries(
    nicknames
      .filter(n => n.nickname)
      .map(n => [n.discordId, cleanNickname(n.nickname)]),
  );
};
