import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
} from '@radix-ui/themes';
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
import { useState } from 'react';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { DropItem } from '~/components/DropItem';

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

  // Get all automated items
  const allAutomatedItems = userAuditData
    .filter(x => x.type === 'AUTOMATED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Fetch OSRS item data for items that have an itemId
  const itemsWithData = await Promise.all(
    allAutomatedItems.map(async item => {
      if (item.itemId === null) {
        return { ...item, osrsData: null };
      }

      const osrsData = await fetchOSRSItem(item.itemId);
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  const totalPages = Math.ceil(allItemsLogged.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = allItemsLogged.slice(startIndex, endIndex);

  // Calculate total GP from all tradeable items
  const totalGP = allItemsLogged.reduce((sum, item) => {
    return sum + (item.osrsData?.price || 0);
  }, 0);

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
              {/* Name and Points */}
              <Flex
                direction="column"
                gap="1"
                align={{ initial: 'center', md: 'start' }}
              >
                <Heading size="6" className="text-white">
                  {user.nickname}
                </Heading>
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
                  {allItemsLogged.length > 0 && (
                    <Box className="text-center">
                      <Text size="2" className="text-gray-400">
                        {'Total Items: '}
                      </Text>
                      <Text size="3" className="text-white">
                        {allItemsLogged.length}
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

        {/* Recent Items Section */}
        {allItemsLogged.length > 0 && (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <Heading size="5" className="mb-4 text-white">
                Recent Items
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

              {totalPages > 1 && (
                <Flex justify="between" align="center" mt="4">
                  <Button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="soft"
                  >
                    Previous
                  </Button>
                  <Text size="2" className="text-gray-400">
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Button
                    onClick={() =>
                      setCurrentPage(p => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    variant="soft"
                  >
                    Next
                  </Button>
                </Flex>
              )}
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
