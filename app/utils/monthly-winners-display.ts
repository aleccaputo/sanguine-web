import type { MonthlyWinnerEventType } from '~/data/monthly-winners';

/**
 * Display constants for the weekly Boss/Raid/Skill rotations, shared by the
 * monthly-winners page and the home noticeboard.
 */

export const EVENT_LABELS: Record<MonthlyWinnerEventType, string> = {
  BOSS: 'Boss of the Week',
  RAID: 'Raid of the Week',
  SKILL: 'Skill of the Week',
};

export const EVENT_TYPES: MonthlyWinnerEventType[] = ['BOSS', 'RAID', 'SKILL'];

export const RANK_ICON: Record<MonthlyWinnerEventType, string> = {
  BOSS: '/rank-icons/botw_winner_rank.png',
  RAID: '/rank-icons/rotw_winner_rank.png',
  SKILL: '/rank-icons/sotw_winner_rank.png',
};
