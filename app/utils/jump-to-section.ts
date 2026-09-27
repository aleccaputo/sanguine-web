/**
 * Scrolls to an in-page section by id and records the hash. A plain hash anchor triggers a
 * router navigation under Remix and scroll restoration stomps the browser's jump with the
 * saved position (the page twitches but lands back where it was until a second click), so
 * callers preventDefault and use this instead. scrollIntoView respects each section's
 * scroll-mt-* offset.
 */
export const jumpToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView();
  window.history.replaceState(null, '', `#${id}`);
};
