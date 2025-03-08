import { getAllUsers, getUserById, ISanguineUser } from '~/data/user';
import { getNicknameById, getNicknames } from '~/data/nicknames';

export interface ISanguineUserWithNickname extends ISanguineUser {
  nickname?: string;
}
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
        // remove the [] points syntax
        nickname:
          nicknameData.nickname && nicknameData.nickname.includes('[')
            ? nicknameData.nickname.split('[')[0].trim()
            : nicknameData.nickname,
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
    nickname:
      nicknameData.nickname && nicknameData.nickname.includes('[')
        ? nicknameData.nickname.split('[')[0].trim()
        : nicknameData.nickname,
  };
};
