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

// WOM reports the monthly winner ranks under generic role names (see
// RANK_IMAGE_OVERRIDES); spell out what they actually mean wherever a rank is
// shown as text. The wrath rank is Sanguine's grandmaster tier.
const RANK_LABEL_OVERRIDES: Record<string, string> = {
  blood: 'RotW winner',
  leader: 'BotW winner',
  skiller: 'SotW winner',
  wrath: 'grandmaster',
};

export const rankLabel = (rank: string) =>
  RANK_LABEL_OVERRIDES[rank.toLocaleLowerCase()] ?? rank.replace(/_/g, ' ');

// Sanguine clan rank hierarchy, highest to lowest. WOM reports the winner ranks
// under generic role names (see RANK_IMAGE_OVERRIDES): blood = rotw, leader =
// botw, skiller = sotw.
const RANK_ORDER = [
  'owner',
  'deputy_owner',
  'administrator',
  'moderator',
  'blood',
  'leader',
  'skiller',
  'quester',
  'wrath',
  'hellcat',
  'beast',
  'tzkal',
  'tztok',
  'myth',
  'legend',
  'destroyer',
  'sage',
  'natural',
  'guest',
];

// Lower index = higher rank. Unknown ranks sort to the bottom.
export const getRankSortIndex = (rankName: string) => {
  const index = RANK_ORDER.indexOf(rankName.toLocaleLowerCase());
  return index === -1 ? RANK_ORDER.length : index;
};
