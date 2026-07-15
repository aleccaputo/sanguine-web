import { faker } from '@faker-js/faker';
import { MOCK_USERS } from '~/mocks/fixtures.server';
import {
  findClogMemberByName,
  type ITempleClogCategories,
  type ITempleGroupClog,
  type ITempleGroupClogMember,
  type ITempleGroupRecentItem,
  type ITempleRecentItem,
  type TempleClogCategoryGroup,
} from '~/utils/collection-log';

export const TEMPLE_GROUP_URL =
  'https://templeosrs.com/groups/overview.php?id=3634';

faker.seed(3634);

const CATEGORY_SHAPES: Record<keyof ITempleClogCategories, string[]> = {
  bosses: [
    'zulrah',
    'vorkath',
    'cerberus',
    'abyssal_sire',
    'alchemical_hydra',
    'giant_mole',
    'general_graardor',
    'corporeal_beast',
  ],
  raids: ['chambers_of_xeric', 'theatre_of_blood', 'tombs_of_amascut'],
  clues: ['beginner_treasure_trails', 'master_treasure_trails'],
  minigames: ['barbarian_assault', 'castle_wars', 'guardians_of_the_rift'],
  other: ['all_pets', 'champions_challenge', 'miscellaneous'],
};

// Deterministic categories: each holds a handful of sequential item ids.
const buildCategories = (): ITempleClogCategories => {
  const idCounter = { next: 1000 };
  const buildGroup = (keys: string[]): TempleClogCategoryGroup =>
    Object.fromEntries(
      keys.map((key): [string, number[]] => {
        const size = faker.number.int({ min: 3, max: 12 });
        const ids = Array.from({ length: size }, () => idCounter.next++);
        return [key, ids];
      }),
    );
  return {
    bosses: buildGroup(CATEGORY_SHAPES.bosses),
    raids: buildGroup(CATEGORY_SHAPES.raids),
    clues: buildGroup(CATEGORY_SHAPES.clues),
    minigames: buildGroup(CATEGORY_SHAPES.minigames),
    other: buildGroup(CATEGORY_SHAPES.other),
  };
};

const MOCK_CATEGORIES = buildCategories();
const ALL_ITEM_IDS: number[] = (
  Object.keys(CATEGORY_SHAPES) as (keyof ITempleClogCategories)[]
).flatMap(groupKey => Object.values(MOCK_CATEGORIES[groupKey]).flat());

const MOCK_ITEM_NAMES: Record<string, string> = Object.fromEntries(
  ALL_ITEM_IDS.map(id => [String(id), faker.commerce.productName()]),
);

// Roughly half the mock roster syncs, plus the occasional alt — mirrors the
// live group where clog coverage is opt-in.
const buildGroupClog = (): ITempleGroupClog => {
  const syncedAccounts = MOCK_USERS.flatMap(user => [
    ...(faker.datatype.boolean(0.55) ? [user.nickname] : []),
    ...user.alts
      .filter(() => faker.datatype.boolean(0.3))
      .map(alt => alt.altName),
  ]);
  const members: ITempleGroupClogMember[] = syncedAccounts.map(name => {
    const items = faker.helpers.arrayElements(
      ALL_ITEM_IDS,
      faker.number.int({ min: 5, max: ALL_ITEM_IDS.length }),
    );
    const lastChanged = faker.date
      .between({ from: '2026-01-01', to: '2026-07-01' })
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    return {
      player: name,
      player_name_with_capitalization: name,
      game_mode: faker.helpers.arrayElement([0, 0, 0, 1, 2, 3]),
      first_sync: '2025-01-01 12:00:00',
      last_checked: lastChanged,
      last_changed: lastChanged,
      ehc: faker.number.float({ min: 100, max: 5000 }),
      total_collections_finished: items.length,
      total_categories_finished: faker.number.int({ min: 0, max: 18 }),
      items,
    };
  });
  return {
    group_id: 3634,
    group_name: 'Sanguine',
    member_count: MOCK_USERS.length,
    members_with_items_synced: members.length,
    total_collections_available: ALL_ITEM_IDS.length,
    total_categories_available: Object.values(MOCK_CATEGORIES).reduce(
      (sum, group) => sum + Object.keys(group).length,
      0,
    ),
    members,
  };
};

const MOCK_GROUP_CLOG = buildGroupClog();

const buildRecentItems = (count: number): ITempleGroupRecentItem[] =>
  Array.from({ length: count }, () => {
    const member = faker.helpers.arrayElement(MOCK_GROUP_CLOG.members);
    const id = faker.helpers.arrayElement(ALL_ITEM_IDS);
    const date = faker.date.between({ from: '2026-05-01', to: '2026-07-01' });
    return {
      id,
      name: MOCK_ITEM_NAMES[String(id)],
      player: member.player,
      player_name_with_capitalization: member.player,
      date: date.toISOString().replace('T', ' ').slice(0, 19),
      date_unix: Math.floor(date.getTime() / 1000),
      notable_item: true,
    };
  }).sort((a, b) => b.date_unix - a.date_unix);

const MOCK_RECENT_ITEMS = buildRecentItems(30);

export const getGroupCollectionLog = async (): Promise<ITempleGroupClog> =>
  MOCK_GROUP_CLOG;

export const getGroupRecentNotableItems = async (): Promise<
  ITempleGroupRecentItem[]
> => MOCK_RECENT_ITEMS;

export const getPlayerRecentItems = async (
  player: string,
): Promise<ITempleRecentItem[]> => {
  const member = findClogMemberByName(MOCK_GROUP_CLOG, player);
  if (!member) return [];
  faker.seed(member.player.length * 7919);
  return buildRecentItems(faker.number.int({ min: 3, max: 25 })).map(
    ({ id, name, date, date_unix, notable_item }) => ({
      id,
      name,
      date,
      date_unix,
      notable_item,
    }),
  );
};

export const getClogCategories = async (): Promise<ITempleClogCategories> =>
  MOCK_CATEGORIES;

export const getClogItemNames = async (): Promise<Record<string, string>> =>
  MOCK_ITEM_NAMES;
