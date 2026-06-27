import type { IPersonalBest } from '~/data/personal-bests';
import { formatAccountWithMain } from '~/utils/account-matching';

export interface IResolvedParticipant {
  discordId: string;
  // "AltName (MainName)" when the player ran on a registered alt, the main nickname otherwise, or
  // "Unknown" if they're no longer a tracked member.
  displayName: string;
  // Whether we know who this is (drives whether the name links to a profile).
  isMember: boolean;
}

// Resolves a PB roster to display names, reusing the shared "AltName (MainName)" convention from
// drops. The alt is taken straight from the stored participantAltNames (the bot validates it at
// submission), so no name-matching is needed here — only formatting.
export const resolvePbParticipants = (
  participantDiscordIds: string[],
  participantAltNames: string[],
  nameByDiscordId: Record<string, string>,
): IResolvedParticipant[] =>
  participantDiscordIds.map((discordId, index) => {
    const mainName = nameByDiscordId[discordId];
    const altName = participantAltNames[index] ?? '';
    if (!mainName) {
      return {
        discordId,
        displayName: altName || 'Unknown',
        isMember: false,
      };
    }
    return {
      discordId,
      displayName: altName ? formatAccountWithMain(altName, mainName) : mainName,
      isMember: true,
    };
  });

// A (boss, scale, invocation) bucket with its fastest times, fastest first.
export interface ICategoryLeaderboard {
  categoryKey: string;
  bossName: string;
  scale: number;
  raidLevel?: number;
  entries: IPersonalBest[];
}

// A boss and all of its categories (e.g. Theatre of Blood → Solo, Duo, Trio…).
export interface IBossLeaderboard {
  bossName: string;
  categories: ICategoryLeaderboard[];
  totalEntries: number;
}

// One of a member's category bests, with where that time ranks against the whole clan.
export interface IUserCategoryBest {
  categoryKey: string;
  bossName: string;
  scale: number;
  raidLevel?: number;
  best: IPersonalBest;
  rank: number;
  totalEntries: number;
  // The registered alt this member ran their best on, or '' if it was their main.
  userAltName: string;
}

// Team-size word, e.g. "Solo", "Trio", "8-man". Invocation is appended for ToA-style content.
export const formatScaleLabel = (scale: number, raidLevel?: number): string => {
  const word =
    scale === 1
      ? 'Solo'
      : scale === 2
        ? 'Duo'
        : scale === 3
          ? 'Trio'
          : `${scale}-man`;
  return raidLevel != null ? `${word} (${raidLevel} Invo)` : word;
};

// Full self-contained label. Solo bosses with no invocation read as just the boss name.
export const formatCategoryLabel = (
  bossName: string,
  scale: number,
  raidLevel?: number,
): string =>
  scale === 1 && raidLevel == null
    ? bossName
    : `${bossName} — ${formatScaleLabel(scale, raidLevel)}`;

const sortCategories = (a: ICategoryLeaderboard, b: ICategoryLeaderboard) =>
  (a.raidLevel ?? 0) - (b.raidLevel ?? 0) || a.scale - b.scale;

// Groups raw PBs into category leaderboards (fastest `limit` per category). Input is assumed
// time-ascending (the queries order by timeSeconds), so the first `limit` seen are the fastest.
export const buildCategoryLeaderboards = (
  personalBests: IPersonalBest[],
  limit = 5,
): ICategoryLeaderboard[] => {
  const byCategory = personalBests.reduce((map, pb) => {
    const existing = map.get(pb.categoryKey);
    if (existing) {
      if (existing.entries.length < limit) {
        existing.entries.push(pb);
      }
    } else {
      map.set(pb.categoryKey, {
        categoryKey: pb.categoryKey,
        bossName: pb.bossName,
        scale: pb.scale,
        raidLevel: pb.raidLevel,
        entries: [pb],
      });
    }
    return map;
  }, new Map<string, ICategoryLeaderboard>());

  return [...byCategory.values()].sort(
    (a, b) => a.bossName.localeCompare(b.bossName) || sortCategories(a, b),
  );
};

// Total submissions per category (independent of the display `limit`).
export const countEntriesByCategory = (
  personalBests: IPersonalBest[],
): Map<string, number> =>
  personalBests.reduce((map, pb) => {
    map.set(pb.categoryKey, (map.get(pb.categoryKey) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

// The distinct discordIds appearing across a set of PBs — the set of names that need resolving.
export const collectParticipantDiscordIds = (
  personalBests: IPersonalBest[],
): string[] => [
  ...new Set(personalBests.flatMap(pb => pb.participantDiscordIds)),
];

// Rolls category leaderboards up under their boss, alphabetical by boss name.
export const buildBossLeaderboards = (
  categories: ICategoryLeaderboard[],
  entryCounts: Map<string, number>,
): IBossLeaderboard[] => {
  const byBoss = categories.reduce((map, category) => {
    const existing = map.get(category.bossName);
    const count = entryCounts.get(category.categoryKey) ?? category.entries.length;
    if (existing) {
      existing.categories.push(category);
      existing.totalEntries += count;
    } else {
      map.set(category.bossName, {
        bossName: category.bossName,
        categories: [category],
        totalEntries: count,
      });
    }
    return map;
  }, new Map<string, IBossLeaderboard>());

  return [...byBoss.values()]
    .map(boss => ({ ...boss, categories: [...boss.categories].sort(sortCategories) }))
    .sort((a, b) => a.bossName.localeCompare(b.bossName));
};

// A member's fastest time in each category they've appeared in, with its clan-wide rank. `allInCategories`
// must contain every submission for those categories so ranks are computed against the full field.
export const buildUserCategoryBests = (
  discordId: string,
  allInCategories: IPersonalBest[],
): IUserCategoryBest[] => {
  // Group every submission by category once, so rank/total are read from the relevant slice rather
  // than re-scanning the whole field per category.
  const entriesByCategory = allInCategories.reduce((map, pb) => {
    const existing = map.get(pb.categoryKey);
    if (existing) {
      existing.push(pb);
    } else {
      map.set(pb.categoryKey, [pb]);
    }
    return map;
  }, new Map<string, IPersonalBest[]>());

  const userBestByCategory = allInCategories
    .filter(pb => pb.participantDiscordIds.includes(discordId))
    .reduce((map, pb) => {
      // Queries are time-ascending, so the first hit per category is already their fastest.
      if (!map.has(pb.categoryKey)) {
        map.set(pb.categoryKey, pb);
      }
      return map;
    }, new Map<string, IPersonalBest>());

  return [...userBestByCategory.values()]
    .map(best => {
      const entries = entriesByCategory.get(best.categoryKey) ?? [best];
      return {
        categoryKey: best.categoryKey,
        bossName: best.bossName,
        scale: best.scale,
        raidLevel: best.raidLevel,
        best,
        rank:
          entries.filter(pb => pb.timeSeconds < best.timeSeconds).length + 1,
        totalEntries: entries.length,
        userAltName:
          best.participantAltNames[
            best.participantDiscordIds.indexOf(discordId)
          ] ?? '',
      };
    })
    .sort(
      (a, b) =>
        a.bossName.localeCompare(b.bossName) ||
        (a.raidLevel ?? 0) - (b.raidLevel ?? 0) ||
        a.scale - b.scale,
    );
};
