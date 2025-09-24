import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Card, Container, Flex, Heading, Text } from '@radix-ui/themes';
import { getUserWithNickname } from '~/services/sanguine-service.server';
import { getAuditDataForUserById } from '~/data/points-audit';
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
import { untradeableItems } from '~/utils/untradable-items';
import { toTitleCase } from '~/utils/string-helpers';

interface OSRSItem {
  id: number;
  name: string;
  icon: string;
}

async function fetchOSRSItemDirect(itemId: number): Promise<OSRSItem | null> {
  try {
    const response = await fetch(
      `https://secure.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=${itemId}`,
      {
        headers: {
          'User-Agent':
            'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
        },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: itemId,
      name: data.item.name,
      icon: data.item.icon,
    };
  } catch (error) {
    console.error(`Failed to fetch OSRS item ${itemId}:`, error);
    return null;
  }
}

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
  const userPromise = getUserWithNickname(params.id ?? '');
  const userAuditDataPromise = getAuditDataForUserById(params.id ?? '');

  const [user, userAuditData] = await Promise.all([
    userPromise,
    userAuditDataPromise,
  ]);

  // Get the 5 most recent automated items
  const allAutomatedItems = userAuditData
    .filter(x => x.type === 'AUTOMATED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Fetch OSRS item data for items that have an itemId
  const itemsWithData = await Promise.all(
    allAutomatedItems.map(async item => {
      if (item.itemId === null) {
        return { ...item, osrsData: null };
      }

      const osrsData = await fetchOSRSItemDirect(item.itemId);
      return { ...item, osrsData };
    }),
  );

  return json(
    {
      user: user,
      auditData: userAuditData,
      allItemsLogged: itemsWithData,
    },
    200,
  );
}

export default function UserById() {
  const { user, auditData, allItemsLogged } = useLoaderData<typeof loader>();

  const summedPointsByYearMonth: { date: string; points: number }[] =
    Object.entries(
      auditData.reduce(
        (accumulator: { [yearMonth: string]: number }, message) => {
          const createdAtYearMonth = dayjs(message.createdAt).format(
            'YYYY-MMM',
          );
          accumulator[createdAtYearMonth] =
            (accumulator[createdAtYearMonth] || 0) + message.pointsGiven;
          return accumulator;
        },
        {},
      ),
    ).map(([date, points]) => ({ date, points }));

  return (
    <Container size="4" mt="3">
      <Flex direction="column" gap="6">
        {/* User Header */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="4">
            <Flex justify="center" align="center">
              <Box className="text-center">
                <Heading size="6" className="text-white">
                  {user.nickname}
                </Heading>
                <Text size="4" className="text-sanguine-red">
                  {user.points} clan points
                </Text>
              </Box>
            </Flex>
          </Box>
          <Flex justify="center" align="center" direction="column">
            <Box className="text-right">
              <Text size="2" className="text-gray-400">
                Member Since:{' '}
              </Text>
              <Text size="3" className="text-white">
                {dayjs(user.joined).format('MMM YYYY')}
              </Text>
            </Box>
            {allItemsLogged.length ? (
              <Box>
                <Text size="2" className="text-gray-400">
                  Total Items:{' '}
                </Text>
                <Text size="3" className="text-white">
                  {allItemsLogged.length}
                </Text>
              </Box>
            ) : null}
          </Flex>
        </Card>

        {/* Recent Items Section */}
        {allItemsLogged.length > 0 && (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <Heading size="5" className="mb-4 text-white">
                Recent Items
              </Heading>
              <Flex direction="column" gap="3">
                {allItemsLogged.slice(0, 5).map(item => (
                  <Card
                    key={item.id}
                    className="border border-gray-700 bg-gray-800"
                  >
                    <Box p="3">
                      <Flex align="center" gap="3">
                        {item.osrsData?.icon && (
                          <Box className="flex-shrink-0">
                            <img
                              src={item.osrsData.icon}
                              alt={item.osrsData.name}
                              className="h-8 w-8"
                            />
                          </Box>
                        )}
                        <Box className="min-w-0 flex-1">
                          <Text size="3" className="block truncate text-white">
                            {item.osrsData?.name ??
                              (item?.itemId
                                ? toTitleCase(
                                    untradeableItems[item.itemId ?? -1],
                                  )
                                : `Item ID ${item.itemId}`)}
                          </Text>
                          <Text size="2" className="text-gray-400">
                            {dayjs(item.createdAt).format('MMM D, YYYY')} •{' '}
                            {item.pointsGiven} points
                          </Text>
                        </Box>
                      </Flex>
                    </Box>
                  </Card>
                ))}
              </Flex>
            </Box>
          </Card>
        )}

        {/* Chart Section */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Heading size="5" className="mb-4 text-white">
              {user.nickname} Points Earned by Month
            </Heading>

            {auditData.length > 0 ? (
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
