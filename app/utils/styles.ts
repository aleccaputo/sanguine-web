/**
 * Shared design-system class strings (see CLAUDE.md "Design System").
 *
 * Zebra rows and hovers are blood-tinted, not neutral — the real OSRS hiscores
 * alternates maroon rows, and white-tint zebra reads sterile by comparison.
 */

/** Dense table/list rows: blood zebra with a hover deepen. */
export const zebraRowClass =
  'even:bg-sanguine-red/[0.05] hover:bg-sanguine-red/[0.09]';

/** Zebra stripe only, for non-interactive rows that shouldn't light up. */
export const zebraStripeClass = 'even:bg-sanguine-red/[0.05]';

/** Prose/content links: member-red, whitening on hover. */
export const proseLinkClass =
  'text-sanguine-bright transition-colors hover:text-white';
