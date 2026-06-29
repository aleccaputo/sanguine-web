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
  // Rank and total are measured against unique teams (each team's fastest time), matching the
  // leaderboard — so "#2 of 4" means 2nd-fastest team out of 4 teams that have logged this
  // category, not 2nd of every individual submission.
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

// Order-independent identity of the team that set a PB: the sorted set of participant Discord IDs.
// Alt labels are intentionally ignored — credit always flows to the Discord owner, so a player on
// their main and that same player on an alt are the same competitor.
const participantSetKey = (pb: IPersonalBest): string =>
  [...new Set(pb.participantDiscordIds)].sort().join(',');

// Collapses a time-ascending list to each distinct team's fastest time. Input must be ascending
// (the queries order by timeSeconds), so a team's first appearance is already its best; order is
// preserved, so the result stays fastest-first. A team that holds several fast times therefore
// occupies a single slot, so more of the clan lands on the board rather than one team taking every
// spot. This is the shared "one entry per unique team" rule behind both the leaderboard and a
// member's clan-wide rank.
const fastestPerTeam = (sortedPersonalBests: IPersonalBest[]): IPersonalBest[] => {
  const seen = new Set<string>();
  return sortedPersonalBests.reduce<IPersonalBest[]>((entries, pb) => {
    const key = participantSetKey(pb);
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(pb);
    }
    return entries;
  }, []);
};

// Groups raw PBs into category leaderboards: each distinct team's fastest time, fastest first, up
// to `limit` per category. Input is assumed time-ascending (the queries order by timeSeconds), so
// the first time seen per team is already their fastest. Records are grouped per category in full
// before trimming — capping during grouping would hide a team's faster-but-later-grouped run.
export const buildCategoryLeaderboards = (
  personalBests: IPersonalBest[],
  limit = 5,
): ICategoryLeaderboard[] => {
  const byCategory = personalBests.reduce((map, pb) => {
    const existing = map.get(pb.categoryKey);
    if (existing) {
      existing.push(pb);
    } else {
      map.set(pb.categoryKey, [pb]);
    }
    return map;
  }, new Map<string, IPersonalBest[]>());

  return [...byCategory.values()]
    .map(categoryPbs => {
      const first = categoryPbs[0];
      return {
        categoryKey: first.categoryKey,
        bossName: first.bossName,
        scale: first.scale,
        raidLevel: first.raidLevel,
        entries: fastestPerTeam(categoryPbs).slice(0, limit),
      };
    })
    .sort((a, b) => a.bossName.localeCompare(b.bossName) || sortCategories(a, b));
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

// A member's fastest time in each category they've appeared in, with its clan-wide rank measured
// against unique teams (matching the leaderboard). `allInCategories` must contain every submission
// for those categories so each team's best — and thus the full field of teams — is known.
export const buildUserCategoryBests = (
  discordId: string,
  allInCategories: IPersonalBest[],
): IUserCategoryBest[] => {
  // Group every submission by category once, then collapse each group to one entry per unique team,
  // so rank/total are read from the relevant team field rather than re-scanning the whole set.
  // Input is time-ascending (the query orders by timeSeconds), so each category slice stays
  // ascending and fastestPerTeam keeps each team's best.
  const submissionsByCategory = allInCategories.reduce((map, pb) => {
    const existing = map.get(pb.categoryKey);
    if (existing) {
      existing.push(pb);
    } else {
      map.set(pb.categoryKey, [pb]);
    }
    return map;
  }, new Map<string, IPersonalBest[]>());
  const teamFieldByCategory = new Map(
    [...submissionsByCategory].map(([key, entries]) => [
      key,
      fastestPerTeam(entries),
    ]),
  );

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
      // The member's best is itself their team's entry in this field, so counting strictly-faster
      // teams gives a rank that can never exceed the team total.
      const teamField = teamFieldByCategory.get(best.categoryKey) ?? [best];
      return {
        categoryKey: best.categoryKey,
        bossName: best.bossName,
        scale: best.scale,
        raidLevel: best.raidLevel,
        best,
        rank:
          teamField.filter(pb => pb.timeSeconds < best.timeSeconds).length + 1,
        totalEntries: teamField.length,
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
