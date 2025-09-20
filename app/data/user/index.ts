import { prisma } from '~/utils/db.server';

export interface ISanguineUser {
  discordId: string;
  points: number;
  joined: string;
}
export const getUserById = async (id: string): Promise<ISanguineUser> => {
  const fullUser = await prisma.users.findUnique({
    where: {
      discordId: id,
    },
  });
  if (!fullUser?.discordId || !fullUser?.joined || !fullUser?.points) {
    throw new Error(`Unable to map user with ID ${id}, missing a property`);
  }
  return {
    discordId: fullUser?.discordId,
    joined: fullUser?.joined,
    points: fullUser?.points,
  };
};

export const getAllUsers = async (): Promise<ISanguineUser[]> => {
  const allUsers = await prisma.users.findMany();
  return allUsers
    .filter(x => x.discordId && x.joined)
    .map(dbUser => ({
      discordId: dbUser.discordId,
      points: dbUser.points ?? 0,
      joined: dbUser.joined,
    }));
};
