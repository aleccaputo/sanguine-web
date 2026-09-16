import type { ITileRaceStanding } from '~/services/tile-race-service.server';

// Stable per-team identities: an OSRS god symbol (from /public/god-symbols)
// paired with the accent color matching its canonical palette. The accent drives
// borders/rails/legend; the symbol is the pawn. Never sanguine red — that means
// members/links.
export const TEAM_IDENTITIES = [
  { color: '#D9A13C', god: 'saradomin' },
  { color: '#4FB4D8', god: 'armadyl' },
  { color: '#6BBF59', god: 'guthix' },
  { color: '#A97BD6', god: 'zaros' },
  { color: '#D66BA0', god: 'zamorak' },
  { color: '#C98A45', god: 'bandos' },
];

export const TEAM_COLORS = TEAM_IDENTITIES.map(identity => identity.color);

export const GOD_BY_COLOR: Record<string, string> = Object.fromEntries(
  TEAM_IDENTITIES.map(identity => [identity.color, identity.god]),
);

/** The god symbol image for a team accent color (the pawn on the board). */
export const godSymbolSrc = (color: string): string =>
  `/god-symbols/${GOD_BY_COLOR[color] ?? 'saradomin'}.png`;

/**
 * Assign each team its accent, by sorted team id so a team keeps the same
 * color on every tile race screen regardless of standings order.
 */
export const assignTeamColors = (
  standings: Pick<ITileRaceStanding, 'teamId'>[],
): Record<string, string> =>
  Object.fromEntries(
    [...standings]
      .sort((a, b) => a.teamId.localeCompare(b.teamId))
      .map((standing, i) => [
        standing.teamId,
        TEAM_COLORS[i % TEAM_COLORS.length],
      ]),
  );
