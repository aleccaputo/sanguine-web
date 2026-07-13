import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { Box, Container, Flex, HoverCard, Table, Text } from '@radix-ui/themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { getAllClanDrops } from '~/data/points-audit';
import {
  computeClanTotals,
  getBossBreakdown,
  getDropsByMonth,
  getMemberLeaderboard,
  getMostCommonItems,
  getMostValuableItems,
} from '~/data/points-audit/stats';
import { getAllUserAlts } from '~/data/user';
import { fetchOSRSItem, OSRSItem } from '~/services/osrs-wiki-prices-service';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import {
  buildAltsByDiscordId,
  resolveDisplayName,
} from '~/utils/account-matching';
import { getBossImageUrl } from '~/utils/competition-images';
import { PageHeader } from '~/components/PageHeader';
import {
  SortableHeaderCell,
  SortConfig,
} from '~/components/SortableHeaderCell';
import { SectionHeading } from '~/components/SectionHeading';
import { ChipGroup } from '~/components/ChipGroup';
import { CoinsIcon } from '~/components/CoinsIcon';
import { EmptyState } from '~/components/EmptyState';
import { proseLinkClass, zebraRowClass } from '~/utils/styles';

// Server-side cache for the expensive loader queries (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaderCache: { data: any; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const TIME_PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: null },
] as const;

type TimePeriod = (typeof TIME_PERIODS)[number];

const VIEWS = [
  { key: 'trends', label: 'Trends' },
  { key: 'bosses', label: 'Bosses' },
  { key: 'items', label: 'Items' },
  { key: 'valuable', label: 'Valuable' },
  { key: 'leaderboard', label: 'Leaderboard' },
] as const;

type ViewKey = (typeof VIEWS)[number]['key'];

export const meta: MetaFunction = () => [
  { title: 'Drop Stats | Sanguine' },
  {
    name: 'description',
    content: 'Clan-wide drop statistics, leaderboards, and boss breakdowns',
  },
];

export async function loader() {
  const now = Date.now();
  if (loaderCache.data && now - loaderCache.timestamp < CACHE_DURATION) {
    return json(loaderCache.data, {
      headers: { 'Cache-Control': 'max-age=3600' },
    });
  }

  const [allDrops, users, allAlts] = await Promise.all([
    getAllClanDrops(),
    getUsersWithNicknames(),
    getAllUserAlts(),
  ]);

  const altsByDiscordId = buildAltsByDiscordId(allAlts);

  // Build item lookup map from unique itemIds
  const uniqueItemIds = [
    ...new Set(
      allDrops.map(d => d.itemId).filter((id): id is number => id != null),
    ),
  ];
  const itemEntries = await Promise.all(
    uniqueItemIds.map(async id => {
      const item = await fetchOSRSItem(id);
      return [id, item] as const;
    }),
  );
  const itemMap = new Map<number, OSRSItem>(
    itemEntries.filter(
      (entry): entry is [number, OSRSItem] => entry[1] != null,
    ),
  );

  // Enrich all drops with osrsData and nicknames for client-side filtering
  const enrichedDrops = allDrops.map(drop => {
    const user = users.find(u => u.discordId === drop.destinationDiscordId);
    const mainName = user?.nickname ?? user?.discordId ?? '';
    const nickname = resolveDisplayName(
      drop.osrsName,
      mainName,
      altsByDiscordId.get(drop.destinationDiscordId) ?? new Set(),
    );
    const osrsData =
      drop.itemId != null ? itemMap.get(drop.itemId) ?? null : null;
    return { ...drop, osrsData, nickname };
  });

  // Build nickname lookup for leaderboard
  const nicknameMap = Object.fromEntries(
    users.map(u => [u.discordId, u.nickname ?? u.discordId]),
  );

  // Serialize itemMap for client-side stat computation
  const serializedItemMap = Object.fromEntries(itemMap);

  const data = { enrichedDrops, nicknameMap, serializedItemMap };
  loaderCache = { data, timestamp: now };

  return json(data, { headers: { 'Cache-Control': 'max-age=3600' } });
}

function compare(a: string | number, b: string | number) {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return (a as number) - (b as number);
}

function useSortableData<K extends string, T>(
  data: T[],
  accessor: (item: T, key: K) => string | number,
  defaultSort?: SortConfig<K>,
  pinToBottom?: (item: T) => boolean,
) {
  const [activeSort, setActiveSort] = useState<SortConfig<K> | null>(
    defaultSort ?? null,
  );

  const sorted = useMemo(() => {
    const effectiveSort = activeSort ?? defaultSort ?? null;

    const sortFn = (a: T, b: T) => {
      if (!effectiveSort) return 0;
      const cmp = compare(
        accessor(a, effectiveSort.key),
        accessor(b, effectiveSort.key),
      );
      return effectiveSort.direction === 'asc' ? cmp : -cmp;
    };

    if (!pinToBottom) {
      return effectiveSort ? [...data].sort(sortFn) : data;
    }

    const regular = data.filter(item => !pinToBottom(item));
    const pinned = data.filter(item => pinToBottom(item));
    return [...(effectiveSort ? regular.sort(sortFn) : regular), ...pinned];
  }, [data, activeSort, defaultSort, accessor, pinToBottom]);

  const toggle = (key: K) => {
    setActiveSort(prev => {
      if (prev?.key !== key) return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key, direction: 'asc' };
      return null;
    });
  };

  return { sorted, activeSort, toggle };
}

// Stable accessors and default sorts live at module scope so useSortableData's
// memo dependencies don't change reference every render.
type BossRow = ReturnType<typeof getBossBreakdown>[number];
type CommonItemRow = ReturnType<typeof getMostCommonItems>[number];
type ValuableRow = ReturnType<typeof getMostValuableItems>[number];
type LeaderboardRow = ReturnType<typeof getMemberLeaderboard>[number] & {
  nickname: string;
};

type BossSortKey = 'bossName' | 'dropCount' | 'totalGP';
type CommonSortKey = 'name' | 'count';
type ValuableSortKey = 'name' | 'price' | 'totalGP' | 'count';
type LeaderboardSortKey = 'nickname' | 'dropCount' | 'totalGP' | 'totalPoints';

const bossAccessor = (item: BossRow, key: BossSortKey) => item[key];
const bossPinToBottom = (item: BossRow) => item.bossName === 'Unknown';
const BOSS_DEFAULT_SORT: SortConfig<BossSortKey> = {
  key: 'totalGP',
  direction: 'desc',
};

const commonAccessor = (item: CommonItemRow, key: CommonSortKey) => item[key];
const COMMON_DEFAULT_SORT: SortConfig<CommonSortKey> = {
  key: 'count',
  direction: 'desc',
};

const valuableAccessor = (item: ValuableRow, key: ValuableSortKey) => {
  if (key === 'name') return item.osrsData.name;
  if (key === 'price') return item.osrsData.price ?? 0;
  return item[key];
};
const VALUABLE_DEFAULT_SORT: SortConfig<ValuableSortKey> = {
  key: 'totalGP',
  direction: 'desc',
};

const leaderboardAccessor = (item: LeaderboardRow, key: LeaderboardSortKey) =>
  item[key];
const LEADERBOARD_DEFAULT_SORT: SortConfig<LeaderboardSortKey> = {
  key: 'totalGP',
  direction: 'desc',
};

export default function DropStats() {
  const { enrichedDrops, nicknameMap, serializedItemMap } =
    useLoaderData<typeof loader>();

  const [period, setPeriod] = useState<TimePeriod>(TIME_PERIODS[4]); // default "All"
  const [view, setView] = useState<ViewKey>('trends');

  const itemMap = useMemo(
    () =>
      new Map<number, OSRSItem>(
        Object.entries(serializedItemMap).map(
          ([k, v]) => [Number(k), v as OSRSItem] as const,
        ),
      ),
    [serializedItemMap],
  );

  const filteredDrops = useMemo(() => {
    if (period.days == null) return enrichedDrops;
    const cutoff = dayjs().subtract(period.days, 'day');
    return enrichedDrops.filter((d: (typeof enrichedDrops)[number]) =>
      dayjs(d.createdAt).isAfter(cutoff),
    );
  }, [enrichedDrops, period]);

  const totals = useMemo(
    () => computeClanTotals(filteredDrops, itemMap),
    [filteredDrops, itemMap],
  );
  const monthlyDrops = useMemo(
    () => getDropsByMonth(filteredDrops),
    [filteredDrops],
  );
  const bossBreakdown = useMemo(
    () => getBossBreakdown(filteredDrops, itemMap),
    [filteredDrops, itemMap],
  );
  const commonItems = useMemo(
    () => getMostCommonItems(filteredDrops, itemMap),
    [filteredDrops, itemMap],
  );
  const mostValuableItems = useMemo(
    () => getMostValuableItems(filteredDrops, itemMap),
    [filteredDrops, itemMap],
  );
  const memberLeaderboard = useMemo(
    () =>
      getMemberLeaderboard(filteredDrops, itemMap).map(m => ({
        ...m,
        nickname: nicknameMap[m.discordId] ?? m.discordId,
      })),
    [filteredDrops, itemMap, nicknameMap],
  );

  const sortedBosses = useSortableData(
    bossBreakdown,
    bossAccessor,
    BOSS_DEFAULT_SORT,
    bossPinToBottom,
  );

  const sortedValuable = useSortableData(
    mostValuableItems,
    valuableAccessor,
    VALUABLE_DEFAULT_SORT,
  );

  const sortedLeaderboard = useSortableData(
    memberLeaderboard,
    leaderboardAccessor,
    LEADERBOARD_DEFAULT_SORT,
  );

  const sortedCommon = useSortableData(
    commonItems,
    commonAccessor,
    COMMON_DEFAULT_SORT,
  );

  const periodPhrase =
    period.days == null ? 'all time' : `the last ${period.label}`;

  return (
    <Container size="3" mt="3">
      <Flex direction="column">
        <PageHeader
          title="Drop statistics"
          iconSrc="https://oldschool.runescape.wiki/images/Coins_detail.png"
        >
          <span className="font-semibold text-white">
            {totals.totalDrops.toLocaleString()}
          </span>{' '}
          drops over {periodPhrase}, worth <CoinsIcon />{' '}
          <span className="font-semibold text-osrs-gold">
            {totals.totalGP.toLocaleString()}
          </span>{' '}
          gp for{' '}
          <span className="font-semibold text-white">
            {totals.totalPoints.toLocaleString()}
          </span>{' '}
          drop points
        </PageHeader>

        {/* View + period chips ride along under the navbar */}
        <Box className="sticky top-[73px] z-10 -mx-4 border-b border-gray-800 bg-[#111113] px-4 py-3 sm:-mx-6 sm:px-6">
          <Flex gap="2" align="center" wrap="wrap">
            <ChipGroup
              options={VIEWS.map(v => ({ key: v.key, label: v.label }))}
              value={view}
              onChange={key => setView(key as ViewKey)}
            />
            <div className="mx-1 hidden h-4 w-px bg-gray-800 sm:block" />
            <ChipGroup
              options={TIME_PERIODS.map(tp => ({
                key: tp.label,
                label: tp.label,
              }))}
              value={period.label}
              onChange={key =>
                setPeriod(
                  TIME_PERIODS.find(tp => tp.label === key) ?? TIME_PERIODS[4],
                )
              }
            />
          </Flex>
        </Box>

        <Box mt="6" mb="6">
          {/* Trends */}
          {view === 'trends' && (
            <section>
              <SectionHeading
                title="Drops over time"
                summary={
                  monthlyDrops.length > 0 ? (
                    <Text size="2" className="text-gray-500">
                      by month · {periodPhrase}
                    </Text>
                  ) : undefined
                }
              />
              {monthlyDrops.length > 0 ? (
                <Box className="mt-3 h-64 sm:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyDrops}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis
                        dataKey="date"
                        stroke="#9CA3AF"
                        fontSize={12}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                        contentStyle={{
                          backgroundColor: '#111113',
                          border: '1px solid #374151',
                          borderRadius: '2px',
                          color: '#F9FAFB',
                        }}
                        formatter={value => [`${value} drops`, 'Drops']}
                      />
                      <Bar dataKey="count" fill="#BB2C23" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}

          {/* Bosses */}
          {view === 'bosses' && (
            <section>
              <SectionHeading
                title="Boss breakdown"
                summary={
                  bossBreakdown.length > 0 ? (
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">{bossBreakdown.length}</span>{' '}
                      bosses · {periodPhrase}
                    </Text>
                  ) : undefined
                }
              />
              {bossBreakdown.length > 0 ? (
                <Box mt="2" className="overflow-x-auto">
                  <Table.Root size="2">
                    <Table.Header>
                      <Table.Row>
                        <SortableHeaderCell
                          label="Boss"
                          columnKey="bossName"
                          activeSort={sortedBosses.activeSort}
                          onToggle={() => sortedBosses.toggle('bossName')}
                        />
                        <SortableHeaderCell
                          label="Drops"
                          columnKey="dropCount"
                          activeSort={sortedBosses.activeSort}
                          onToggle={() => sortedBosses.toggle('dropCount')}
                          align="right"
                          className="hidden sm:table-cell"
                        />
                        <SortableHeaderCell
                          label="Total GP"
                          columnKey="totalGP"
                          activeSort={sortedBosses.activeSort}
                          onToggle={() => sortedBosses.toggle('totalGP')}
                          align="right"
                        />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {sortedBosses.sorted.map(boss => (
                        <Table.Row
                          key={boss.bossName}
                          className={zebraRowClass}
                        >
                          <Table.Cell className="text-white">
                            <Flex align="center" gap="2">
                              <Box className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                                <img
                                  src={getBossImageUrl(boss.bossName)}
                                  alt={boss.bossName}
                                  className="max-h-8 max-w-8 object-contain"
                                />
                              </Box>
                              {boss.bossName}
                            </Flex>
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="hidden tabular-nums text-gray-200 sm:table-cell"
                          >
                            {boss.dropCount.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="tabular-nums text-osrs-gold"
                          >
                            {boss.totalGP.toLocaleString()}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}

          {/* Items */}
          {view === 'items' && (
            <section>
              <SectionHeading
                title="Most common items"
                summary={
                  commonItems.length > 0 ? (
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">{commonItems.length}</span>{' '}
                      items · {periodPhrase}
                    </Text>
                  ) : undefined
                }
              />
              {commonItems.length > 0 ? (
                <Box mt="2" className="overflow-x-auto">
                  <Table.Root size="2">
                    <Table.Header>
                      <Table.Row>
                        <SortableHeaderCell
                          label="Item"
                          columnKey="name"
                          activeSort={sortedCommon.activeSort}
                          onToggle={() => sortedCommon.toggle('name')}
                        />
                        <SortableHeaderCell
                          label="Drops"
                          columnKey="count"
                          activeSort={sortedCommon.activeSort}
                          onToggle={() => sortedCommon.toggle('count')}
                          align="right"
                        />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {sortedCommon.sorted.map(item => (
                        <Table.Row key={item.itemId} className={zebraRowClass}>
                          <Table.Cell className="text-white">
                            <Flex align="center" gap="3">
                              {item.icon && (
                                <Box className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                                  <img
                                    src={item.icon}
                                    alt={item.name}
                                    className="max-h-8 max-w-8 object-contain"
                                  />
                                </Box>
                              )}
                              <Text size="2" weight="medium">
                                {item.name}
                              </Text>
                            </Flex>
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="tabular-nums text-gray-200"
                          >
                            {item.count.toLocaleString()}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}

          {/* Valuable */}
          {view === 'valuable' && (
            <section>
              <SectionHeading
                title="Most valuable items"
                summary={
                  mostValuableItems.length > 0 ? (
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">
                        {mostValuableItems.length}
                      </span>{' '}
                      items · {periodPhrase}
                    </Text>
                  ) : undefined
                }
              />
              {mostValuableItems.length > 0 ? (
                <Box mt="2" className="overflow-x-auto">
                  <Table.Root size="2">
                    <Table.Header>
                      <Table.Row>
                        <SortableHeaderCell
                          label="Item"
                          columnKey="name"
                          activeSort={sortedValuable.activeSort}
                          onToggle={() => sortedValuable.toggle('name')}
                        />
                        <SortableHeaderCell
                          label="Price"
                          columnKey="price"
                          activeSort={sortedValuable.activeSort}
                          onToggle={() => sortedValuable.toggle('price')}
                          align="right"
                          className="hidden sm:table-cell"
                        />
                        <SortableHeaderCell
                          label="Total GP"
                          columnKey="totalGP"
                          activeSort={sortedValuable.activeSort}
                          onToggle={() => sortedValuable.toggle('totalGP')}
                          align="right"
                        />
                        <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                          Recipients
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {sortedValuable.sorted.map(item => (
                        <Table.Row key={item.itemId} className={zebraRowClass}>
                          <Table.Cell className="text-white">
                            <Flex align="center" gap="3">
                              {item.osrsData.icon && (
                                <Box className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                                  <img
                                    src={item.osrsData.icon}
                                    alt={item.osrsData.name}
                                    className="max-h-8 max-w-8 object-contain"
                                  />
                                </Box>
                              )}
                              <Flex direction="column">
                                <Text size="2" weight="medium">
                                  {item.osrsData.name}
                                </Text>
                                {item.count > 1 && (
                                  <Text size="1" className="text-gray-400">
                                    {item.count} drops
                                  </Text>
                                )}
                              </Flex>
                            </Flex>
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="hidden tabular-nums text-osrs-gold sm:table-cell"
                          >
                            {(item.osrsData.price ?? 0).toLocaleString()}
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="tabular-nums text-osrs-gold"
                          >
                            {item.totalGP.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <Flex direction="column" gap="1">
                              <Text size="1" className="truncate text-gray-400">
                                {item.recipients.slice(0, 2).map((r, i) => (
                                  <span key={r.discordId}>
                                    <Link
                                      to={`/users/${r.discordId}`}
                                      className={proseLinkClass}
                                    >
                                      {r.nickname}
                                      {r.count > 1 ? ` x${r.count}` : ''}
                                    </Link>
                                    {i <
                                      Math.min(item.recipients.length, 2) - 1 &&
                                      ', '}
                                  </span>
                                ))}
                              </Text>
                              {item.recipients.length > 2 && (
                                <HoverCard.Root>
                                  <HoverCard.Trigger>
                                    <Text
                                      size="1"
                                      className="cursor-pointer text-gray-500 transition-colors hover:text-gray-300"
                                    >
                                      +{item.recipients.length - 2} more
                                    </Text>
                                  </HoverCard.Trigger>
                                  <HoverCard.Content
                                    style={{
                                      backgroundColor: '#111113',
                                      border: '1px solid #374151',
                                      borderRadius: '2px',
                                      padding: '8px 12px',
                                    }}
                                  >
                                    <Flex direction="column" gap="1">
                                      {item.recipients.slice(2).map(r => (
                                        <Link
                                          key={r.discordId}
                                          to={`/users/${r.discordId}`}
                                          className={proseLinkClass}
                                        >
                                          <Text size="1">
                                            {r.nickname}
                                            {r.count > 1 ? ` x${r.count}` : ''}
                                          </Text>
                                        </Link>
                                      ))}
                                    </Flex>
                                  </HoverCard.Content>
                                </HoverCard.Root>
                              )}
                            </Flex>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}

          {/* Leaderboard */}
          {view === 'leaderboard' && (
            <section>
              <SectionHeading
                title="Top members by GP"
                summary={
                  memberLeaderboard.length > 0 ? (
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">
                        {memberLeaderboard.length}
                      </span>{' '}
                      members · {periodPhrase}
                    </Text>
                  ) : undefined
                }
              />
              {memberLeaderboard.length > 0 ? (
                <Box mt="2" className="overflow-x-auto">
                  <Table.Root size="2">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell className="w-10 text-osrs-orange">
                          #
                        </Table.ColumnHeaderCell>
                        <SortableHeaderCell
                          label="Member"
                          columnKey="nickname"
                          activeSort={sortedLeaderboard.activeSort}
                          onToggle={() => sortedLeaderboard.toggle('nickname')}
                        />
                        <SortableHeaderCell
                          label="Drops"
                          columnKey="dropCount"
                          activeSort={sortedLeaderboard.activeSort}
                          onToggle={() => sortedLeaderboard.toggle('dropCount')}
                          align="right"
                          className="hidden sm:table-cell"
                        />
                        <SortableHeaderCell
                          label="Total GP"
                          columnKey="totalGP"
                          activeSort={sortedLeaderboard.activeSort}
                          onToggle={() => sortedLeaderboard.toggle('totalGP')}
                          align="right"
                        />
                        <SortableHeaderCell
                          label="Points"
                          columnKey="totalPoints"
                          activeSort={sortedLeaderboard.activeSort}
                          onToggle={() =>
                            sortedLeaderboard.toggle('totalPoints')
                          }
                          align="right"
                          className="hidden sm:table-cell"
                        />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {sortedLeaderboard.sorted.map((member, i) => (
                        <Table.Row
                          key={member.discordId}
                          className={zebraRowClass}
                        >
                          <Table.Cell className="text-gray-600">
                            {i + 1}
                          </Table.Cell>
                          <Table.Cell>
                            <Link
                              to={`/users/${member.discordId}`}
                              className={proseLinkClass}
                            >
                              {member.nickname}
                            </Link>
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="hidden tabular-nums text-gray-200 sm:table-cell"
                          >
                            {member.dropCount.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="tabular-nums text-osrs-gold"
                          >
                            {member.totalGP.toLocaleString()}
                          </Table.Cell>
                          <Table.Cell
                            align="right"
                            className="hidden tabular-nums text-white sm:table-cell"
                          >
                            {member.totalPoints.toLocaleString()}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}
        </Box>
      </Flex>
    </Container>
  );
}
