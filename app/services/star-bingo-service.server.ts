import starCollectorData from '../allStarCollectorResults.json';

export interface StarCollector {
  nickname: string;
  discord_id: string;
  total_submissions: number;
  unique_items: number;
  item_ids: string;
  items_submitted: string;
}

type StarCollectorSanitized = Omit<StarCollector, 'discord_id'>;

export const getStarCollectorsStats = async (): Promise<
  StarCollectorSanitized[]
> => {
  const data = starCollectorData as StarCollector[];
  // Strip out the discord_id from each item
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return data.map(({ discord_id, ...rest }) => rest);
};
