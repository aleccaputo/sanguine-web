import { prisma } from '~/utils/db.server';
import {
  comparePbTimes,
  IMPRECISE_PB_PENALTY_SECONDS,
} from '~/utils/personal-bests';

// Clean shape for personal bests across the web app. Mirrors the `PersonalBests` collection the
// Discord bot writes on approval, dropping moderation-only fields (screenshot, approver, etc.).
export interface IPersonalBest {
  id: string;
  bossName: string;
  raidLevel?: number;
  scale: number;
  categoryKey: string;
  timeDisplay: string;
  timeSeconds: number;
  // Whether the time was submitted with a decimal (in-game precise timing on). Without it the game
  // rounds to the nearest second, so the true time may be up to 0.4s slower than displayed.
  isPreciseTime: boolean;
  // The seconds value everything ranks by: timeSeconds as-is when precise, +0.4s worst case when not.
  effectiveTimeSeconds: number;
  participantDiscordIds: string[];
  // Index-aligned with participantDiscordIds: the registered alt a participant ran on, or '' for
  // their main. Credit always belongs to the Discord owner — this is just a label.
  participantAltNames: string[];
  proofMessageUrl?: string;
  createdAt: string;
}

type PersonalBestRow = {
  id: string;
  bossName: string;
  raidLevel: number | null;
  scale: number;
  categoryKey: string;
  timeDisplay: string;
  timeSeconds: number;
  isPreciseTime: boolean | null;
  effectiveTimeSeconds: number | null;
  participantDiscordIds: string[];
  participantAltNames: string[];
  proofMessageUrl: string | null;
  createdAt: string;
};

const PERSONAL_BEST_SELECT = {
  id: true,
  bossName: true,
  raidLevel: true,
  scale: true,
  categoryKey: true,
  timeDisplay: true,
  timeSeconds: true,
  isPreciseTime: true,
  effectiveTimeSeconds: true,
  participantDiscordIds: true,
  participantAltNames: true,
  proofMessageUrl: true,
  createdAt: true,
} as const;

const toPersonalBest = (row: PersonalBestRow): IPersonalBest => {
  // Legacy rows predate the precision fields (until the bot's backfill migration runs) — re-derive
  // them from the display string, which is the source of truth either way.
  const isPreciseTime = row.isPreciseTime ?? row.timeDisplay.includes('.');
  return {
    id: row.id,
    bossName: row.bossName,
    raidLevel: row.raidLevel ?? undefined,
    scale: row.scale,
    categoryKey: row.categoryKey,
    timeDisplay: row.timeDisplay,
    timeSeconds: row.timeSeconds,
    isPreciseTime,
    effectiveTimeSeconds:
      row.effectiveTimeSeconds ??
      row.timeSeconds + (isPreciseTime ? 0 : IMPRECISE_PB_PENALTY_SECONDS),
    participantDiscordIds: row.participantDiscordIds,
    // Legacy rows predate alt tracking (the field comes back empty) — pad so it always lines up
    // one-to-one with participants, treating any missing slot as a main.
    participantAltNames: row.participantDiscordIds.map(
      (_, index) => row.participantAltNames?.[index] ?? '',
    ),
    proofMessageUrl: row.proofMessageUrl ?? undefined,
    createdAt: row.createdAt,
  };
};

export const getAllPersonalBests = async (): Promise<IPersonalBest[]> => {
  const rows = await prisma.personalBests.findMany({
    select: PERSONAL_BEST_SELECT,
  });
  // Sorted in app code (not the DB) so legacy rows missing effectiveTimeSeconds rank correctly —
  // downstream grouping relies on this effective-time-ascending order.
  return rows.map(toPersonalBest).sort(comparePbTimes);
};

// The distinct categories a member has a PB in. Only the categoryKey is read (not whole rows),
// since the full leaderboard for those categories is fetched separately for ranking.
export const getPersonalBestCategoryKeysForDiscordId = async (
  discordId: string,
): Promise<string[]> => {
  const rows = await prisma.personalBests.findMany({
    where: { participantDiscordIds: { has: discordId } },
    select: { categoryKey: true },
  });
  return [...new Set(rows.map(row => row.categoryKey))];
};

// All PBs in the given categories — used to rank a member's times against the rest of the clan.
export const getPersonalBestsByCategoryKeys = async (
  categoryKeys: string[],
): Promise<IPersonalBest[]> => {
  if (categoryKeys.length === 0) {
    return [];
  }
  const rows = await prisma.personalBests.findMany({
    where: { categoryKey: { in: categoryKeys } },
    select: PERSONAL_BEST_SELECT,
  });
  // Same app-side effective-time sort as getAllPersonalBests.
  return rows.map(toPersonalBest).sort(comparePbTimes);
};
