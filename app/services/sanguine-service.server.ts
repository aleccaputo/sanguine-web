import { getAllUsers, ISanguineUser } from '~/data/user';
import { getNicknames } from '~/data/nicknames';

interface ISanguineUserWithNickname extends ISanguineUser {
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
				nickname: nicknameData.nickname.split('[')[0].trim(),
			};
		} catch (e) {
			return user;
		}
	});

	return usersWithNicknames;
};
