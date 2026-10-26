import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service.server';
import type { IClogItemData } from '~/utils/collection-log';
import { wikiItemIconUrl } from '~/utils/osrs-item';
import { toTitleCase } from '~/utils/string-helpers';

/**
 * Item display data for a Temple clog item: the wiki mapping supplies the
 * name, icon, and GE price for anything it knows; untracked untradeables fall
 * back to a wiki icon URL built from Temple's own item name.
 */
export const resolveClogItemData = async (item: {
  id: number;
  name: string;
}): Promise<IClogItemData> => {
  const osrsData = await fetchOSRSItem(item.id);
  return (
    osrsData ?? {
      id: item.id,
      name: toTitleCase(item.name),
      icon: wikiItemIconUrl(item.name),
    }
  );
};
