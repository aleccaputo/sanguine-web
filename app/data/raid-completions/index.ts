import { prisma } from '~/utils/db.server';

// Per-participant award breakdown as the Discord bot persists it on raid approval.
export interface IRaidParticipantAward {
  discordId: string;
  // Flat base for taking part; 0 when the participant hit the daily cap.
  basePoints: number;
  // New-teammate bonus total — exempt from the daily cap.
  bonusPoints: number;
  newTeammateDiscordIds: string[];
  rotwApplied: boolean;
  capped: boolean;
  // (base + bonus) * RoTW multiplier — what actually landed in the clan-points bucket.
  totalPoints: number;
}

// Clean shape for approved /submitraid completions across the web app. Mirrors the
// `RaidCompletions` collection the Discord bot writes, dropping moderation-only fields.
export interface IRaidCompletion {
  id: string;
  // Human-readable WOM metric name at save time, e.g. 'Theatre Of Blood Hard Mode'.
  raidDisplayName: string;
  participantDiscordIds: string[];
  // Whether the Raid of the Week multiplier was in effect for this submission.
  rotwApplied: boolean;
  awards: IRaidParticipantAward[];
  approvedAt: string;
}

// A member's approved raids, newest first (approvedAt is ISO, so string order is time order).
export const getRaidCompletionsForDiscordId = async (
  discordId: string,
): Promise<IRaidCompletion[]> => {
  const rows = await prisma.raidCompletions.findMany({
    where: { participantDiscordIds: { has: discordId } },
    select: {
      id: true,
      raidDisplayName: true,
      participantDiscordIds: true,
      rotwApplied: true,
      awards: true,
      approvedAt: true,
    },
    orderBy: { approvedAt: 'desc' },
  });
  return rows;
};
