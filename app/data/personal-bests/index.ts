import { prisma } from '~/utils/db.server';

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
  participantDiscordIds: true,
  participantAltNames: true,
  proofMessageUrl: true,
  createdAt: true,
} as const;

const toPersonalBest = (row: PersonalBestRow): IPersonalBest => ({
  id: row.id,
  bossName: row.bossName,
  raidLevel: row.raidLevel ?? undefined,
  scale: row.scale,
  categoryKey: row.categoryKey,
  timeDisplay: row.timeDisplay,
  timeSeconds: row.timeSeconds,
  participantDiscordIds: row.participantDiscordIds,
  // Legacy rows predate alt tracking (the field comes back empty) — pad so it always lines up
  // one-to-one with participants, treating any missing slot as a main.
  participantAltNames: row.participantDiscordIds.map(
    (_, index) => row.participantAltNames?.[index] ?? '',
  ),
  proofMessageUrl: row.proofMessageUrl ?? undefined,
  createdAt: row.createdAt,
});

export const getAllPersonalBests = async (): Promise<IPersonalBest[]> => {
  const rows = await prisma.personalBests.findMany({
    select: PERSONAL_BEST_SELECT,
    orderBy: { timeSeconds: 'asc' },
  });
  return rows.map(toPersonalBest);
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
    orderBy: { timeSeconds: 'asc' },
  });
  return rows.map(toPersonalBest);
};
