import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Card, Container, Flex, Heading, Text, Button } from '@radix-ui/themes';
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
import { PointAudit } from '@prisma/client';
import { useState } from 'react';
import {
  fetchOSRSItemDirect,
  OSRSItem,
} from '~/services/osrs-wiki-prices-service';

interface AuditWithOsrsItem extends PointAudit {
  osrsData: OSRSItem | null;
}

const displayItemText = (item: AuditWithOsrsItem) => {
  if (item?.itemId && !isNaN(item?.itemId)) {
    const untradableItem = untradeableItems[item?.itemId ?? -100];
    if (!untradableItem) {
      console.error(
        `No item name found for itemId: ${item?.itemId} for userId: ${item.destinationDiscordId}`,
      );
      return `Item ID: ${item.itemId}`;
    }

    return toTitleCase(untradableItem);
  }
  return 'No Item ID found';
};

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
              <Flex direction="column" gap="2">
                {currentItems.map(item => (
                  <Box
                    key={item.id}
                    className="border-b border-gray-800 py-2 last:border-b-0"
                  >
                    <Flex align="center" gap="3">
                      {item.osrsData?.icon && (
                        <Box className="flex-shrink-0">
                          <img
                            src={item.osrsData.icon}
                            alt={item.osrsData.name}
                            className="h-6 w-6"
                          />
                        </Box>
                      )}
                      <Box className="min-w-0 flex-1">
                        <Flex align="center" gap="2" justify="between">
                          <Text size="2" className="truncate text-white">
                            {item.osrsData?.name ?? displayItemText(item)}
                          </Text>
                          <Text size="1" className="text-gray-400 whitespace-nowrap">
                            {dayjs(item.createdAt).format('MMM D, YYYY')} • {item.pointsGiven} pts
                          </Text>
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>
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
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
