// Some in-game winner ranks are reported by Wise Old Man under a generic role
// name that doesn't match our icon filenames, so they need an explicit mapping.
const RANK_IMAGE_OVERRIDES: Record<string, string> = {
  leader: 'botw_winner_rank',
  blood: 'rotw_winner_rank',
  skiller: 'sotw_winner_rank',
};

export const fetchRankImage = (rankName: string) => {
  const rank = rankName.toLocaleLowerCase();
  return `/rank-icons/${RANK_IMAGE_OVERRIDES[rank] ?? rank}.png`;
};
