import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  HoverCard,
  Tabs,
  Table,
  Text,
} from '@radix-ui/themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CaretSortIcon, ArrowUpIcon, ArrowDownIcon } from '@radix-ui/react-icons';
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
import { buildAltsByDiscordId, resolveDisplayName } from '~/utils/account-matching';
import { StatBox } from '~/components/StatBox';
import { getBossImageUrl } from '~/utils/competition-images';

// Server-side cache for the expensive loader queries (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loaderCache: { data: any; timestamp: number } = { data: null, timestamp: 0 };

const TIME_PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: null },
] as const;

type TimePeriod = (typeof TIME_PERIODS)[number];

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
    return json(loaderCache.data, { headers: { 'Cache-Control': 'max-age=3600' } });
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
      drop.itemId != null ? (itemMap.get(drop.itemId) ?? null) : null;
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

type SortDirection = 'asc' | 'desc';
type SortConfig<K extends string> = { key: K; direction: SortDirection };

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
  const [activeSort, setActiveSort] = useState<SortConfig<K> | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    const effectiveSort = activeSort ?? defaultSort ?? null;

    const sortFn = (a: T, b: T) => {
      if (!effectiveSort) return 0;
      const cmp = compare(accessor(a, effectiveSort.key), accessor(b, effectiveSort.key));
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

function SortIndicator<K extends string>({ columnKey, activeSort }: { columnKey: K; activeSort: SortConfig<K> | null }) {
  if (activeSort?.key !== columnKey) return <CaretSortIcon className="ml-1 inline text-gray-600" />;
  return activeSort.direction === 'asc'
    ? <ArrowUpIcon className="ml-1 inline text-gray-300" />
    : <ArrowDownIcon className="ml-1 inline text-gray-300" />;
}

export default function DropStats() {
  const { enrichedDrops, nicknameMap, serializedItemMap } =
    useLoaderData<typeof loader>();

  const [period, setPeriod] = useState<TimePeriod>(TIME_PERIODS[4]); // default "All"

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
    return enrichedDrops.filter(
      (d: (typeof enrichedDrops)[number]) => dayjs(d.createdAt).isAfter(cutoff),
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
    (item, key: 'bossName' | 'dropCount' | 'totalGP') => item[key],
    { key: 'totalGP', direction: 'desc' },
    item => item.bossName === 'Unknown',
  );

  const sortedValuable = useSortableData(
    mostValuableItems,
    (item, key: 'name' | 'price' | 'totalGP' | 'count') => {
      if (key === 'name') return item.osrsData.name;
      if (key === 'price') return item.osrsData.price ?? 0;
      return item[key];
    },
    { key: 'totalGP', direction: 'desc' },
  );

  const sortedLeaderboard = useSortableData(
    memberLeaderboard,
    (item, key: 'nickname' | 'dropCount' | 'totalGP' | 'totalPoints') => item[key],
    { key: 'totalGP', direction: 'desc' },
  );

  const sortedCommon = useSortableData(
    commonItems,
    (item, key: 'name' | 'count') => item[key],
    { key: 'count', direction: 'desc' },
  );

  return (
    <Container size="4" mt="3" px="3">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Box className="text-center">
          <Heading size="6" className="text-white">
            Clan Drop Statistics
          </Heading>
          <Text size="2" className="text-gray-400">
            Clan-wide statistics and leaderboards
          </Text>
        </Box>

        {/* Summary Cards */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Flex
              direction={{ initial: 'column', md: 'row' }}
              justify="between"
              gap="4"
            >
              <StatBox label="Total Drops" value={totals.totalDrops.toLocaleString()} />
              <StatBox
                label="Total GP Value"
                value={totals.totalGP.toLocaleString()}
                valueClassName="font-medium text-amber-400"
              />
              <StatBox
                label="Total Points"
                value={totals.totalPoints.toLocaleString()}
                valueClassName="font-medium text-sanguine-red"
              />
            </Flex>
          </Box>
        </Card>

        {/* Tabbed Content */}
        <Tabs.Root defaultValue="trends">
          <Flex direction="column" gap="2">
            <div className="relative">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <Tabs.List>
                  <Tabs.Trigger value="trends">Trends</Tabs.Trigger>
                  <Tabs.Trigger value="bosses">Bosses</Tabs.Trigger>
                  <Tabs.Trigger value="items">Items</Tabs.Trigger>
                  <Tabs.Trigger value="valuable">Valuable</Tabs.Trigger>
                  <Tabs.Trigger value="leaderboard">Leaderboard</Tabs.Trigger>
                </Tabs.List>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-gray-950 to-transparent sm:hidden" />
            </div>
            <Flex gap="2">
              {TIME_PERIODS.map(tp => (
                <Button
                  key={tp.label}
                  size="1"
                  variant={period.label === tp.label ? 'solid' : 'soft'}
                  color={period.label === tp.label ? 'red' : 'gray'}
                  onClick={() => setPeriod(tp)}
                >
                  {tp.label}
                </Button>
              ))}
            </Flex>
          </Flex>

          <Box pt="4">
            {/* Trends Tab */}
            <Tabs.Content value="trends">
              {monthlyDrops.length > 0 ? (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5">
                    <Heading size="5" className="mb-4 text-white">
                      Drops Over Time
                    </Heading>
                    <Box className="h-64 sm:h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyDrops}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
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
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F9FAFB',
                            }}
                            formatter={value => [`${value} drops`, 'Drops']}
                          />
                          <Bar dataKey="count" fill="#BB2C23" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                </Card>
              ) : (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5" className="py-12 text-center">
                    <Text size="3" className="text-gray-400">
                      No drop data for this period
                    </Text>
                  </Box>
                </Card>
              )}
            </Tabs.Content>

            {/* Bosses Tab */}
            <Tabs.Content value="bosses">
              {bossBreakdown.length > 0 ? (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5">
                    <Heading size="5" className="mb-4 text-white">
                      Boss Breakdown
                    </Heading>
                    <div className="overflow-x-auto">
                      <Table.Root>
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" onClick={() => sortedBosses.toggle('bossName')}>
                              Boss<SortIndicator columnKey="bossName" activeSort={sortedBosses.activeSort} />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="hidden cursor-pointer select-none text-gray-400 sm:table-cell" align="right" onClick={() => sortedBosses.toggle('dropCount')}>
                              Drops<SortIndicator columnKey="dropCount" activeSort={sortedBosses.activeSort} />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" align="right" onClick={() => sortedBosses.toggle('totalGP')}>
                              Total GP<SortIndicator columnKey="totalGP" activeSort={sortedBosses.activeSort} />
                            </Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {sortedBosses.sorted.map(boss => (
                            <Table.Row key={boss.bossName}>
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
                              <Table.Cell align="right" className="hidden text-gray-300 sm:table-cell">
                                {boss.dropCount.toLocaleString()}
                              </Table.Cell>
                              <Table.Cell align="right" className="text-amber-400">
                                {boss.totalGP.toLocaleString()}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </div>
                  </Box>
                </Card>
              ) : (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5" className="py-12 text-center">
                    <Text size="3" className="text-gray-400">
                      No boss data for this period
                    </Text>
                  </Box>
                </Card>
              )}
            </Tabs.Content>

            {/* Items Tab */}
            <Tabs.Content value="items">
              {commonItems.length > 0 ? (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5">
                    <Heading size="5" className="mb-4 text-white">
                      Most Common Items
                    </Heading>
                    <div className="overflow-x-auto">
                      <Table.Root>
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" onClick={() => sortedCommon.toggle('name')}>
                              Item<SortIndicator columnKey="name" activeSort={sortedCommon.activeSort} />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" align="right" onClick={() => sortedCommon.toggle('count')}>
                              Drops<SortIndicator columnKey="count" activeSort={sortedCommon.activeSort} />
                            </Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {sortedCommon.sorted.map(item => (
                            <Table.Row key={item.itemId}>
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
                              <Table.Cell align="right" className="text-gray-300">
                                {item.count.toLocaleString()}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </div>
                  </Box>
                </Card>
              ) : (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5" className="py-12 text-center">
                    <Text size="3" className="text-gray-400">
                      No item data for this period
                    </Text>
                  </Box>
                </Card>
              )}
            </Tabs.Content>

            {/* Valuable Drops Tab */}
            <Tabs.Content value="valuable">
              {mostValuableItems.length > 0 ? (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5">
                    <Heading size="5" className="mb-4 text-white">
                      Most Valuable Items
                    </Heading>
                    <div className="overflow-x-auto">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" onClick={() => sortedValuable.toggle('name')}>
                            Item<SortIndicator columnKey="name" activeSort={sortedValuable.activeSort} />
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className="hidden cursor-pointer select-none text-gray-400 sm:table-cell" onClick={() => sortedValuable.toggle('price')}>
                            Price<SortIndicator columnKey="price" activeSort={sortedValuable.activeSort} />
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" onClick={() => sortedValuable.toggle('totalGP')}>
                            Total GP<SortIndicator columnKey="totalGP" activeSort={sortedValuable.activeSort} />
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className="hidden text-gray-400 md:table-cell">
                            Recipients
                          </Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {sortedValuable.sorted.map(item => (
                          <Table.Row key={item.itemId}>
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
                            <Table.Cell className="hidden text-amber-400 sm:table-cell">
                              {(item.osrsData.price ?? 0).toLocaleString()}
                            </Table.Cell>
                            <Table.Cell className="text-amber-400">
                              {item.totalGP.toLocaleString()}
                            </Table.Cell>
                            <Table.Cell className="hidden md:table-cell">
                              <Flex direction="column" gap="1">
                                <Text size="1" className="truncate text-gray-400">
                                  {item.recipients.slice(0, 2).map((r, i) => (
                                    <span key={r.discordId}>
                                      <Link
                                        to={`/users/${r.discordId}`}
                                        className="text-gray-400 transition-colors hover:text-sanguine-red"
                                      >
                                        {r.nickname}
                                        {r.count > 1 ? ` x${r.count}` : ''}
                                      </Link>
                                      {i < Math.min(item.recipients.length, 2) - 1 && ', '}
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
                                        backgroundColor: '#1F2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                      }}
                                    >
                                      <Flex direction="column" gap="1">
                                        {item.recipients.slice(2).map(r => (
                                          <Link
                                            key={r.discordId}
                                            to={`/users/${r.discordId}`}
                                            className="text-gray-300 transition-colors hover:text-sanguine-red"
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
                    </div>
                  </Box>
                </Card>
              ) : (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5" className="py-12 text-center">
                    <Text size="3" className="text-gray-400">
                      No valuable drops for this period
                    </Text>
                  </Box>
                </Card>
              )}
            </Tabs.Content>

            {/* Leaderboard Tab */}
            <Tabs.Content value="leaderboard">
              {memberLeaderboard.length > 0 ? (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5">
                    <Heading size="5" className="mb-4 text-white">
                      Top Members by GP Value
                    </Heading>
                    <div className="overflow-x-auto">
                      <Table.Root>
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell className="text-gray-400">
                              #
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" onClick={() => sortedLeaderboard.toggle('nickname')}>
                              Member<SortIndicator columnKey="nickname" activeSort={sortedLeaderboard.activeSort} />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="hidden cursor-pointer select-none text-gray-400 sm:table-cell" align="right" onClick={() => sortedLeaderboard.toggle('dropCount')}>
                              Drops<SortIndicator columnKey="dropCount" activeSort={sortedLeaderboard.activeSort} />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="cursor-pointer select-none text-gray-400" align="right" onClick={() => sortedLeaderboard.toggle('totalGP')}>
                              Total GP<SortIndicator columnKey="totalGP" activeSort={sortedLeaderboard.activeSort} />
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="hidden cursor-pointer select-none text-gray-400 sm:table-cell" align="right" onClick={() => sortedLeaderboard.toggle('totalPoints')}>
                              Points<SortIndicator columnKey="totalPoints" activeSort={sortedLeaderboard.activeSort} />
                            </Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {sortedLeaderboard.sorted.map((member, i) => (
                            <Table.Row key={member.discordId}>
                              <Table.Cell className="text-gray-400">{i + 1}</Table.Cell>
                              <Table.Cell>
                                <Link
                                  to={`/users/${member.discordId}`}
                                  className="text-white transition-colors hover:text-sanguine-red"
                                >
                                  {member.nickname}
                                </Link>
                              </Table.Cell>
                              <Table.Cell align="right" className="hidden text-gray-300 sm:table-cell">
                                {member.dropCount.toLocaleString()}
                              </Table.Cell>
                              <Table.Cell align="right" className="text-amber-400">
                                {member.totalGP.toLocaleString()}
                              </Table.Cell>
                              <Table.Cell align="right" className="hidden text-sanguine-red sm:table-cell">
                                {member.totalPoints.toLocaleString()}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </div>
                  </Box>
                </Card>
              ) : (
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5" className="py-12 text-center">
                    <Text size="3" className="text-gray-400">
                      No leaderboard data for this period
                    </Text>
                  </Box>
                </Card>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>

        {/* Bottom spacer */}
        <Box mb="6" />
      </Flex>
    </Container>
  );
}
