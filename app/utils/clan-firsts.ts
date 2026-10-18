// Clan Firsts for The Fractured Archive (Raids 4): the first teams to clear and the first members
// to receive each unique. Nothing is stored; both boards are derived from approved
// RaidCompletions and AUTOMATED PointAudit rows. Mirrors the Discord bot's ClanFirstService and
// services/constants/clanFirsts.ts — keep the rules, release floor and boards in sync.

// /submitraid metric the bot stores for the raid.
export const TFA_METRIC = 'the_fractured_archive';
export const TFA_DISPLAY_NAME = 'The Fractured Archive';

// Anything recorded before release (test drops, early submissions) never counts.
export const TFA_RELEASE_ISO = '2026-10-20T00:00:00.000Z';

export const CLAN_FIRST_SLOTS = 5;

export type ClanFirstDropBoard = {
  key: string;
  displayName: string;
  // Item names (case-insensitive) resolved to ids through the wiki mapping and the local
  // untradeables table. Same names as the bot's points-sheet list.
  itemNames: string[];
  // Explicit ids for anything the name lookup can't resolve (e.g. a brand-new untradeable).
  itemIds?: number[];
};

// Names from the pre-release wiki. Confirm against the in-game names on release day.
export const TFA_DROP_BOARDS: ClanFirstDropBoard[] = [
  {
    key: 'elemental_fragments',
    displayName: 'Elemental fragments',
    itemNames: ['Elemental fragments'],
  },
  { key: 'rondache', displayName: 'Rondache', itemNames: ['Rondache'] },
  {
    key: 'zoryas_tome',
    displayName: "Zorya's Tome",
    itemNames: ["Zorya's Tome"],
  },
  { key: 'zeal', displayName: 'Zeal', itemNames: ['Zeal'] },
  {
    key: 'ascension_crossbows',
    displayName: 'Ascension crossbows',
    itemNames: ['Ascension crossbows'],
  },
  {
    key: 'the_obligator',
    displayName: 'The Obligator',
    itemNames: ['The Obligator'],
  },
  // Deliberately unmatched, as in the bot: Dink pet drops all share the sheet's generic "pet" id,
  // so an item-based match would count every pet from every boss.
  { key: 'pet', displayName: 'Pet', itemNames: [] },
];

export type DropFirstRow = {
  destinationDiscordId: string;
  createdAt: string;
  osrsName?: string | null;
};

export type DropFirstPlacement = {
  placement: number;
  discordId: string;
  osrsName: string | null;
  achievedAt: string;
};

// The first `slots` distinct members to receive the item, oldest first; a member's later drops
// never take a second spot. createdAt is ISO-8601 UTC, so string order is time order.
export const firstUniquePlayers = (
  rows: DropFirstRow[],
  slots = CLAN_FIRST_SLOTS,
): DropFirstPlacement[] =>
  [...rows]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter(
      (row, index, sorted) =>
        sorted.findIndex(
          other => other.destinationDiscordId === row.destinationDiscordId,
        ) === index,
    )
    .slice(0, slots)
    .map((row, index) => ({
      placement: index + 1,
      discordId: row.destinationDiscordId,
      osrsName: row.osrsName ?? null,
      achievedAt: row.createdAt,
    }));

export type ClearFirstRow = {
  participantDiscordIds: string[];
  approvedAt: string;
  proofMessageUrl?: string | null;
};

export type ClearFirstPlacement = {
  placement: number;
  // Members who earned this spot: the team minus anyone already holding an earlier one.
  creditedDiscordIds: string[];
  // Teammates who were already placed higher, shown alongside but not credited.
  alreadyPlacedDiscordIds: string[];
  achievedAt: string;
  proofMessageUrl: string | null;
};

// The first `slots` clears by approval time (when the bot announced and paid them; mods approve
// in submission order). A member is only ever credited once: a later
// team's spot goes to its net-new members, and a team with none takes no spot at all.
export const rankClearsWithNetNew = (
  rows: ClearFirstRow[],
  slots = CLAN_FIRST_SLOTS,
): ClearFirstPlacement[] =>
  [...rows]
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt))
    .reduce<ClearFirstPlacement[]>((placements, row) => {
      if (placements.length >= slots) return placements;
      const placed = new Set(placements.flatMap(p => p.creditedDiscordIds));
      const team = [...new Set(row.participantDiscordIds)];
      const creditedDiscordIds = team.filter(id => !placed.has(id));
      if (creditedDiscordIds.length === 0) return placements;
      return [
        ...placements,
        {
          placement: placements.length + 1,
          creditedDiscordIds,
          alreadyPlacedDiscordIds: team.filter(id => placed.has(id)),
          achievedAt: row.approvedAt,
          proofMessageUrl: row.proofMessageUrl ?? null,
        },
      ];
    }, []);

// Every item id a board counts: names resolved through `idsByName` (lowercased keys) plus any
// explicit ids.
export const boardItemIds = (
  board: ClanFirstDropBoard,
  idsByName: Record<string, number[]>,
): number[] => [
  ...new Set([
    ...board.itemNames.flatMap(name => idsByName[name.toLowerCase()] ?? []),
    ...(board.itemIds ?? []),
  ]),
];
