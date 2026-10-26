/**
 * Item shape and pure helpers shared by client components and the server-only
 * wiki price service (`~/services/osrs-wiki-prices-service.server`).
 */
export interface OSRSItem {
  id: number;
  name: string;
  icon: string;
  price?: number; // GE price for tradeable items
}

/**
 * Formats an item name for use in a Wiki image URL
 * Example: "staff of the dead" -> "Staff_of_the_dead"
 */
const formatItemNameForWiki = (name: string): string =>
  name
    .split(' ')
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join('_');

/** Detail-image URL on the OSRS Wiki for an item name. */
export const wikiItemIconUrl = (name: string): string =>
  `https://oldschool.runescape.wiki/images/${formatItemNameForWiki(name)}_detail.png`;
