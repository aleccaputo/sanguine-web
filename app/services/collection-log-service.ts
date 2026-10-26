import { fetch } from '@remix-run/web-fetch';
import { createLogger } from '~/utils/logger.server';
import { trackOutbound } from '~/utils/outbound.server';

const log = createLogger('collection-log');
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

/**
 * @deprecated
 * @param username
 */
export const getRecentItemsForUser = async (username: string) => {
  const requestUri = `${baseUri}/items/recent/${username}`;
  const response = await trackOutbound('collectionlog', 'items.recent', () =>
    fetch(requestUri),
  );

  if (!response.ok) {
    log.error(
      { username, status: response.status },
      'Unable to fetch collection log items',
    );
    return null;
  }
  const recentItems = await response.json();
  return {
    recentItems: recentItems.items,
    nickname: username,
  } as IRecentCollectionLogItemWithNickname;
};
