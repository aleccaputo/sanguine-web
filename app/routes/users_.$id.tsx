import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Tabs,
  Text,
} from '@radix-ui/themes';
import { getUserWithNickname } from '~/services/sanguine-service.server';
import { getAuditDataForUserById } from '~/data/points-audit';
import { getUserAlts } from '~/data/user';
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
import { useCallback, useMemo, useState } from 'react';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { AccountsTooltip } from '~/components/AccountsTooltip';
import { DropItem } from '~/components/DropItem';
import { Pagination } from '~/components/Pagination';
import { getClanFromWom } from '~/services/wom-api-service.server';
import { fetchRankImage } from '~/utils/clan-ranks';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.user?.nickname
    ? `Members | ${data.user.nickname}`
    : 'Members | Sanguine Member';

  const description = data?.user?.nickname
    ? `More information about ${data.user.nickname}`
    : 'More information about a member';

  return [{ title }, { name: 'description', content: description }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const discordId = params.id ?? '';

  const [user, userAuditData, sanguineWomMembers, userAlts] = await Promise.all(
    [
      getUserWithNickname(discordId),
      getAuditDataForUserById(discordId),
      getClanFromWom(18435),
      getUserAlts(discordId),
    ],
  );

  const allAutomatedItems = userAuditData
    .filter(x => x.type === 'AUTOMATED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const itemsWithData = await Promise.all(
    allAutomatedItems.map(async item => {
      if (item.itemId === null) {
        return { ...item, osrsData: null };
      }
      const osrsData = await fetchOSRSItem(item.itemId);
      return { ...item, osrsData };
    }),
  );

  const findWomRole = (name: string) =>
    sanguineWomMembers.find(
      x => x.player.displayName.toLowerCase() === name.toLowerCase(),
    )?.role;

  const womRoles: Record<string, string | undefined> = {};
  if (user.nickname) womRoles[user.nickname] = findWomRole(user.nickname);
  for (const alt of userAlts) {
    womRoles[alt.altName] = findWomRole(alt.altName);
  }

  return json({
    user,
    auditData: userAuditData,
    allItemsLogged: itemsWithData,
    womRoles,
    userAlts,
  });
}

// Account key used for "all accounts" combined view
const ALL_ACCOUNTS = 'all';

export default function UserById() {
  const { user, auditData, allItemsLogged, womRoles, userAlts } =
    useLoaderData<typeof loader>();

  const hasAlts = userAlts.length > 0;
  const mainName = user.nickname ?? '';

  // selectedAccount is either ALL_ACCOUNTS, mainName, or an alt's altName
  const [selectedAccount, setSelectedAccount] = useState(ALL_ACCOUNTS);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const matchesAccount = useCallback(
    (osrsName: string | null, accountName: string) => {
      if (accountName === mainName) {
        // Main: legacy null records + explicitly named main records
        return (
          osrsName === null ||
          osrsName.toLowerCase() === mainName.toLowerCase()
        );
      }
      return osrsName?.toLowerCase() === accountName.toLowerCase();
    },
    [mainName],
  );

  const filteredItems = useMemo(() => {
    if (selectedAccount === ALL_ACCOUNTS) return allItemsLogged;
    return allItemsLogged.filter(item =>
      matchesAccount(item.osrsName, selectedAccount),
    );
  }, [selectedAccount, allItemsLogged, matchesAccount]);

  const filteredAuditData = useMemo(() => {
    if (selectedAccount === ALL_ACCOUNTS) return auditData;
    return auditData.filter(item =>
      matchesAccount(item.osrsName, selectedAccount),
    );
  }, [selectedAccount, auditData, matchesAccount]);

  const dropCountByAccount = useMemo(() => {
    const counts: Record<string, number> = { [ALL_ACCOUNTS]: allItemsLogged.length };
    counts[mainName] = allItemsLogged.filter(item =>
      matchesAccount(item.osrsName, mainName),
    ).length;
    for (const alt of userAlts) {
      counts[alt.altName] = allItemsLogged.filter(item =>
        matchesAccount(item.osrsName, alt.altName),
      ).length;
    }
    return counts;
  }, [allItemsLogged, userAlts, mainName, matchesAccount]);

  const currentWomRole =
    selectedAccount === ALL_ACCOUNTS
      ? womRoles[mainName]
      : womRoles[selectedAccount];

  const summedPointsByYearMonth: { date: string; points: number }[] =
    Object.entries(
      filteredAuditData.reduce(
        (acc: { [yearMonth: string]: number }, message) => {
          const ym = dayjs(message.createdAt).format('YYYY-MMM');
          acc[ym] = (acc[ym] || 0) + message.pointsGiven;
          return acc;
        },
        {},
      ),
    ).map(([date, points]) => ({ date, points }));

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const totalGP = filteredItems.reduce(
    (sum, item) => sum + (item.osrsData?.price || 0),
    0,
  );

  const getRankIcon = (rankName: string) => (
    <img
      src={fetchRankImage(rankName)}
      alt={rankName}
      width={26}
      height={26}
      className="inline-block"
    />
  );

  const handleAccountChange = (value: string) => {
    setSelectedAccount(value);
    setCurrentPage(1);
  };

  const displayName =
    selectedAccount === ALL_ACCOUNTS
      ? mainName
      : selectedAccount;

  return (
    <Container size="4" mt="3">
      <Flex direction="column" gap="6">
        {/* User Header */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Flex
              direction={{ initial: 'column', md: 'row' }}
              justify={{ md: 'between' }}
              align={{ initial: 'center', md: 'center' }}
              gap="4"
            >
              {/* Name, rank, and points */}
              <Flex
                direction="column"
                gap="2"
                align={{ initial: 'center', md: 'start' }}
              >
                <Flex align="center" gap="2">
                  {getRankIcon(currentWomRole ?? 'Guest')}
                  <Heading size="6" className="text-white">
                    {displayName}
                  </Heading>
                  {hasAlts && selectedAccount === ALL_ACCOUNTS && (
                    <AccountsTooltip
                      accounts={[
                        { name: mainName, role: womRoles[mainName] },
                        ...userAlts.map(alt => ({
                          name: alt.altName,
                          role: womRoles[alt.altName],
                        })),
                      ]}
                    >
                      <Badge color="gray" variant="soft" radius="full">
                        {1 + userAlts.length} accounts
                      </Badge>
                    </AccountsTooltip>
                  )}
                </Flex>
                <Text size="4" className="text-sanguine-red">
                  {user.points} clan points
                </Text>
              </Flex>

              {/* Stats */}
              <Flex gap="6" align="center">
                <Flex direction="column" gap="2" align="center">
                  <Box className="text-center">
                    <Text size="2" className="text-gray-400">
                      {'Member Since: '}
                    </Text>
                    <Text size="3" className="text-white">
                      {dayjs(user.joined).format('MMM YYYY')}
                    </Text>
                  </Box>
                  {filteredItems.length > 0 && (
                    <Box className="text-center">
                      <Text size="2" className="text-gray-400">
                        {'Total Items: '}
                      </Text>
                      <Text size="3" className="text-white">
                        {filteredItems.length}
                      </Text>
                    </Box>
                  )}
                </Flex>
                {totalGP > 0 && (
                  <Box className="text-center">
                    <Text size="2" className="text-gray-400">
                      Total Value
                    </Text>
                    <Flex align="center" justify="center" gap="1">
                      <img
                        src="https://oldschool.runescape.wiki/images/Coins_detail.png"
                        alt="GP"
                        className="h-4 w-4 object-contain"
                      />
                      <Text size="3" className="text-amber-400">
                        {totalGP.toLocaleString()}
                      </Text>
                    </Flex>
                  </Box>
                )}
              </Flex>
            </Flex>
          </Box>
        </Card>

        {/* Account Switcher — only shown when alts exist */}
        {hasAlts && (
          <Card className="border border-gray-800 bg-gray-900">
            <Box px="5" py="3">
              <Flex align="center" gap="3" wrap="wrap">
                <Text size="2" className="text-gray-400">
                  Account:
                </Text>
                <Tabs.Root
                  value={selectedAccount}
                  onValueChange={handleAccountChange}
                >
                  <Tabs.List>
                    <Tabs.Trigger value={ALL_ACCOUNTS}>
                      <Flex align="center" gap="2">
                        All
                        <Badge color="gray" variant="soft" radius="full" size="1">
                          {dropCountByAccount[ALL_ACCOUNTS]}
                        </Badge>
                      </Flex>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={mainName}>
                      <Flex align="center" gap="2">
                        {womRoles[mainName] &&
                          getRankIcon(womRoles[mainName]!)}
                        {mainName}
                        <Badge color="gray" variant="soft" radius="full" size="1">
                          {dropCountByAccount[mainName] ?? 0}
                        </Badge>
                      </Flex>
                    </Tabs.Trigger>
                    {userAlts.map(alt => (
                      <Tabs.Trigger key={alt.id} value={alt.altName}>
                        <Flex align="center" gap="2">
                          {womRoles[alt.altName] &&
                            getRankIcon(womRoles[alt.altName]!)}
                          {alt.altName}
                          <Badge
                            color="gray"
                            variant="soft"
                            radius="full"
                            size="1"
                          >
                            {dropCountByAccount[alt.altName] ?? 0}
                          </Badge>
                        </Flex>
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs.Root>
              </Flex>
            </Box>
          </Card>
        )}

        {/* Recent Items Section */}
        {filteredItems.length > 0 && (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <Heading size="5" className="mb-4 text-white">
                Recent Items
                {hasAlts && selectedAccount !== ALL_ACCOUNTS && (
                  <Text
                    size="3"
                    className="ml-2 font-normal text-gray-400"
                    as="span"
                  >
                    — {selectedAccount}
                  </Text>
                )}
              </Heading>
              <Flex direction="column">
                {currentItems.map(item => (
                  <DropItem
                    key={item.id}
                    item={item}
                    showRecipient={false}
                    size="small"
                  />
                ))}
              </Flex>

              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
                onNext={() =>
                  setCurrentPage(p => Math.min(totalPages, p + 1))
                }
              />
            </Box>
          </Card>
        )}

        {filteredItems.length === 0 && selectedAccount !== ALL_ACCOUNTS && (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5" className="py-12 text-center">
              <Text size="3" className="text-gray-400">
                No drops recorded for {selectedAccount}
              </Text>
            </Box>
          </Card>
        )}

        {/* Chart Section */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Heading size="5" className="mb-4 text-white">
              {selectedAccount === ALL_ACCOUNTS ? mainName : selectedAccount} Points
              Earned by Month
            </Heading>

            {filteredAuditData.length > 0 ? (
              <Box className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summedPointsByYearMonth}>
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
                      formatter={value => [`${value} points`, 'Points']}
                    />
                    <Bar
                      dataKey="points"
                      fill="#BB2C23"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box className="py-12 text-center">
                <Text size="3" className="text-gray-400">
                  No points on record
                </Text>
              </Box>
            )}
          </Box>
        </Card>
      </Flex>
    </Container>
  );
}
