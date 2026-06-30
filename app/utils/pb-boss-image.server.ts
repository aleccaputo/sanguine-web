import { Boss, MetricProps } from '@wise-old-man/utils';
import {
  getBossImageUrl,
  getCompetitionImageUrl,
  hasCompetitionImage,
} from '~/utils/competition-images';

// Personal bests store the boss as the Wise Old Man metric display name (e.g. "Theatre Of Blood",
// "Chambers Of Xeric (CM)"), which differs in casing from the drop boss names. Map each display
// name back to its WOM metric key so we can reuse the curated competition images.
const metricKeyByDisplayName: Record<string, string> = Object.fromEntries(
  Object.values(Boss).map(boss => [MetricProps[boss].name, boss as string]),
);

// Resolves a boss/raid image URL for a PB boss name, preferring the curated competition image and
// falling back to the drop image resolver (which handles plain single-name bosses well).
export const getPbBossImageUrl = (bossName: string): string => {
  const metricKey = metricKeyByDisplayName[bossName];
  if (metricKey && hasCompetitionImage(metricKey)) {
    return getCompetitionImageUrl(metricKey);
  }
  return getBossImageUrl(bossName);
};

// Builds a name -> image-url lookup for a set of PB boss names (resolved server-side so the WOM
// metric tables aren't shipped to the client).
export const buildBossImageMap = (
  bossNames: string[],
): Record<string, string> =>
  Object.fromEntries(
    [...new Set(bossNames)].map(name => [name, getPbBossImageUrl(name)]),
  );
