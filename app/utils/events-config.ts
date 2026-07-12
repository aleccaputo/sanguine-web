/**
 * Discord IDs to exclude from event participant maps, leaderboards, and charts.
 * Add entries here to hide a member from all event displays.
 */
export const EVENTS_EXCLUDED_DISCORD_IDS = new Set(['189862407340949504']);

/**
 * Competitions that live outside the clan's WOM group list (one-off bingos and
 * inter-clan events), fetched by id and merged into competition listings.
 * Order matters for the events page: the first entry leads the list, the rest
 * are appended after the group competitions in this order.
 */
export const SPECIAL_COMPETITION_IDS = [
  144882, // Gotta Boss 'Em All (2026)
  128016, // Sanguine February 2026
  121056, // Star Collectors v2
  107621, // Fall 2025 Bingo
  101103, // Coalition Bingo
  79514, // Star Bingo
  46594, // RNG Bingo
];
