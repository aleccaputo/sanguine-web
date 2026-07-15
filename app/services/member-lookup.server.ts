import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAllUserAlts } from '~/data/user';
import { getClanFromWom } from '~/services/wom-api-service.server';
import { normalizeRsn } from '~/utils/collection-log';

export interface IRsnMemberBridge {
  /** Normalized RSN (nickname or alt name) to the owning member's discordId. */
  discordIdByRsn: Map<string, string>;
  /** Normalized WOM display name to the account's clan role. */
  roleByRsn: Map<string, string>;
}

/**
 * External trackers know RSNs; the site knows members. One bridge from
 * normalized RSN to discordId (via nicknames and alt names) and to WOM role,
 * so every page that renders tracker data links and ranks members the same
 * way. All three sources sit behind their own caches/mocks.
 */
export const getRsnMemberBridge = async (): Promise<IRsnMemberBridge> => {
  const [users, userAlts, womMembers] = await Promise.all([
    getUsersWithNicknames(),
    getAllUserAlts(),
    getClanFromWom(),
  ]);
  const discordIdByRsn = new Map([
    ...users
      .filter(user => user.nickname)
      .map(
        user => [normalizeRsn(user.nickname ?? ''), user.discordId] as const,
      ),
    ...userAlts.map(alt => [normalizeRsn(alt.altName), alt.discordId] as const),
  ]);
  const roleByRsn = new Map(
    womMembers.map(member => [
      normalizeRsn(member.player.displayName),
      member.role,
    ]),
  );
  return { discordIdByRsn, roleByRsn };
};
