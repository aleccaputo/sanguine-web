import { prisma } from '~/utils/db.server';

export const getNicknameById = (discordId: string) => {
	return prisma.userNicknames.findFirst({
		where: {
			discordId: discordId,
		},
	});
};

export const getNicknames = () => {
	return prisma.userNicknames.findMany();
};
