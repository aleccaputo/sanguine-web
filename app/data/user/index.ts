import { prisma } from '~/utils/db.server';

export interface ISanguineUser {
  discordId: string;
  // Drop-driven points — the number shown next to a member's name.
  points: number;
  // Clan-activity bucket (team raids, events, competitions). Legacy docs lack the field; coalesced to 0.
  clanPoints: number;
  joined: string;
}
// Null when no member has this discordId (stale or hand-typed profile links). A member with
// 0 drop points is still a member, so points are not part of the existence check.
export const getUserById = async (
  id: string,
): Promise<ISanguineUser | null> => {
  const fullUser = await prisma.users.findUnique({
    where: {
      discordId: id,
    },
  });
  if (!fullUser) {
    return null;
  }
  return {
    discordId: fullUser.discordId,
    joined: fullUser.joined,
    points: fullUser.points ?? 0,
    clanPoints: fullUser.clanPoints ?? 0,
  };
};

export const getAllUsers = async (): Promise<ISanguineUser[]> => {
  const allUsers = await prisma.users.findMany();
  return allUsers
    .filter(x => x.discordId && x.joined)
    .map(dbUser => ({
      discordId: dbUser.discordId,
      points: dbUser.points ?? 0,
      clanPoints: dbUser.clanPoints ?? 0,
      joined: dbUser.joined,
    }));
};

export interface ISanguineUserAlt {
  id: string;
  altName: string;
}

export const getUserAlts = async (
  discordId: string,
): Promise<ISanguineUserAlt[]> => {
  const alts = await prisma.userAlts.findMany({ where: { discordId } });
  return alts.map(alt => ({ id: alt.id, altName: alt.altName }));
};

export const getAllUserAlts = async (): Promise<
  (ISanguineUserAlt & { discordId: string })[]
> => {
  const alts = await prisma.userAlts.findMany();
  return alts.map(alt => ({
    id: alt.id,
    altName: alt.altName,
    discordId: alt.discordId,
  }));
};
