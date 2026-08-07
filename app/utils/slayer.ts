import {
  getBossImageUrl,
  getCompetitionImageUrl,
  hasCompetitionImage,
} from '~/utils/competition-images';

/** The Slayer skill icon — the page's game asset, same source as competition thumbnails. */
export const SLAYER_ICON =
  'https://oldschool.runescape.wiki/images/Slayer_icon.png';

/** Wheel modes, mirroring the bot's WheelMode enum. */
export const WHEEL_MODE = {
  /** The always-on grind: flat clan points per completed task, no end date. */
  STANDING: 'STANDING',
  /** A time-boxed competition: bonus drop points, a leaderboard, prizes. */
  EVENT: 'EVENT',
} as const;

/**
 * Wheel-pool metrics whose image the shared resolvers get wrong or miss: the pool is keyed by
 * current WOM metric slugs (`kreearra`, `vetion`), while the competition map predates some of
 * them, and WOM display names don't always match the wiki's file capitalization (`Kree'Arra`
 * vs the wiki's `Kree'arra.png`). Verified against the live wiki, one entry per broken URL.
 */
const BOSS_IMAGE_BY_METRIC: Record<string, string> = {
  // Chests and multi-boss encounters have no image of their own.
  barrows_chests: 'Ahrim_the_Blighted.png',
  lunar_chests: 'Eclipse_Moon.png',
  the_royal_titans: 'Branda_the_Fire_Queen.png',
  // Capitalization the wiki's file names don't share.
  kreearra: "Kree'arra.png",
  shellbane_gryphon: 'Shellbane_gryphon.png',
};

/**
 * Loot totals the way the game writes them (1.2m, 340k), for the dense columns where a full
 * gp figure would wrap. Prose and infobox rows still spell the number out.
 */
export const formatGp = (gp: number): string => {
  if (gp >= 1_000_000_000) return `${(gp / 1_000_000_000).toFixed(1)}b`;
  if (gp >= 1_000_000) return `${(gp / 1_000_000).toFixed(1)}m`;
  if (gp >= 10_000) return `${Math.round(gp / 1_000)}k`;
  return gp.toLocaleString();
};

/**
 * Thumbnail for an assigned boss. Tasks store both the WOM metric and the display name they
 * were spun with, so this prefers the curated per-metric asset, then the competition image,
 * then the drop-log resolver's guess from the display name.
 */
export const getSlayerBossImageUrl = (
  bossMetric: string,
  bossDisplayName: string,
): string => {
  const override = BOSS_IMAGE_BY_METRIC[bossMetric];
  if (override) {
    return `https://oldschool.runescape.wiki/images/${override}`;
  }
  return hasCompetitionImage(bossMetric)
    ? getCompetitionImageUrl(bossMetric)
    : getBossImageUrl(bossDisplayName);
};
