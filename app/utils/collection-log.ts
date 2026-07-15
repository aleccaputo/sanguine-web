import {
  fetchOSRSItem,
  wikiItemIconUrl,
} from '~/services/osrs-wiki-prices-service';
import { toTitleCase } from '~/utils/string-helpers';

/**
 * Shared TempleOSRS collection log shapes and pure helpers. The I/O lives in
 * temple-api-service.server.ts (mocked under MOCK_MODE); everything here is
 * client-safe and imported by the real service, the mock, and the routes, so
 * matching/resolution rules exist in exactly one place.
 */

export interface ITempleGroupClogMember {
  player: string;
  player_name_with_capitalization: string;
  // 0 = Main, 1 = IM, 2 = UIM, 3 = HCIM
  game_mode: number;
  first_sync: string;
  last_checked: string;
  last_changed: string;
  ehc: number;
  total_collections_finished: number;
  total_categories_finished: number;
  items: number[];
}

export interface ITempleGroupClog {
  group_id: number;
  group_name: string;
  member_count: number;
  members_with_items_synced: number;
  total_collections_available: number;
  total_categories_available: number;
  members: ITempleGroupClogMember[];
}

export interface ITempleRecentItem {
  id: number;
  name: string;
  date: string;
  date_unix: number;
  notable_item: boolean;
}

export interface ITempleGroupRecentItem extends ITempleRecentItem {
  player: string;
  player_name_with_capitalization: string;
}

/** Category key (e.g. "abyssal_sire") to the item ids the category contains. */
export type TempleClogCategoryGroup = Record<string, number[]>;

export interface ITempleClogCategories {
  bosses: TempleClogCategoryGroup;
  raids: TempleClogCategoryGroup;
  clues: TempleClogCategoryGroup;
  minigames: TempleClogCategoryGroup;
  other: TempleClogCategoryGroup;
}

export const COLLECTION_LOG_ICON =
  'https://oldschool.runescape.wiki/images/Collection_log_detail.png';

export const CATEGORY_GROUP_LABELS: Record<
  keyof ITempleClogCategories,
  string
> = {
  bosses: 'Bosses',
  raids: 'Raids',
  clues: 'Clues',
  minigames: 'Minigames',
  other: 'Other',
};

// "chambers_of_xeric" -> "Chambers of Xeric"
const MINOR_WORDS = new Set(['of', 'the', 'and', 'to', 'in', 'a', 'an']);
export const formatCategoryName = (key: string): string =>
  key
    .split('_')
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');

/** OSRS names compare space/underscore/hyphen- and case-insensitively. */
export const normalizeRsn = (name: string): string =>
  name.toLowerCase().replace(/[_-]/g, ' ').trim();

/** Find a synced member's log by RSN, tolerant of name formatting. */
export const findClogMemberByName = (
  groupClog: ITempleGroupClog,
  name: string,
): ITempleGroupClogMember | undefined =>
  groupClog.members.find(
    member => normalizeRsn(member.player) === normalizeRsn(name),
  );

export interface IClogItemData {
  id: number;
  name: string;
  icon: string;
  price?: number;
}

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
