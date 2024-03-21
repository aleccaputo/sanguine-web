import { fetch } from '@remix-run/web-fetch';

const baseUri = 'https://api.collectionlog.net';

interface IRecentCollectionLogItem {
  id: number;
  name: string;
  quantity: number;
  obtained: boolean;
  obtainedAt: string;
}

interface IRecentCollectionLogItemWithNickname {
  nickname: string;
  recentItems: IRecentCollectionLogItem[];
}
export const getRecentItemsForUser = async (username: string) => {
  const requestUri = `${baseUri}/items/recent/${username}`;
  const response = await fetch(requestUri);

  if (!response.ok) {
    console.error(`Unable to fetch collection log items for ${username}`);
    // throw new Error(`Unable to fetch collection log items for ${username}`);
    return;
  }
  const recentItems = await response.json();
  return {
    recentItems: recentItems.items,
    nickname: username,
  } as IRecentCollectionLogItemWithNickname;
};
