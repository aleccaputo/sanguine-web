export const fetchRankImage = (rankName: string) => {
  return `/rank-icons/${rankName.toLocaleLowerCase()}.png`;
};
