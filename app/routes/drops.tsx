import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { Box, Card, Container, Flex, Heading, Text, Button } from '@radix-ui/themes';
import { getClanDropsPaginated } from '~/data/points-audit';
import dayjs from 'dayjs';
import { untradeableItems } from '~/utils/untradable-items';
import { toTitleCase } from '~/utils/string-helpers';
import { PointAudit } from '@prisma/client';
import {
  fetchOSRSItemDirect,
  OSRSItem,
} from '~/services/osrs-wiki-prices-service';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';

interface AuditWithOsrsItem extends PointAudit {
  osrsData: OSRSItem | null;
  nickname?: string;
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

export const meta: MetaFunction = () => {
  return [
    { title: 'Recent Drops | Sanguine' },
    {
      name: 'description',
      content: 'View the most recent drops from clan members',
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 10;

  const [{ drops, totalCount, currentPage, totalPages }, users] =
    await Promise.all([
      getClanDropsPaginated(page, pageSize),
      getUsersWithNicknames(),
    ]);

  // Fetch OSRS item data for items that have an itemId
  const itemsWithData = await Promise.all(
    drops.map(async item => {
      const user = users.find(u => u.discordId === item.destinationDiscordId);
      const osrsData =
        item.itemId !== null ? await fetchOSRSItemDirect(item.itemId) : null;

      return {
        ...item,
        osrsData,
        nickname: user?.nickname,
      };
    }),
  );

  return json(
    {
      recentDrops: itemsWithData,
      currentPage,
      totalPages,
      totalCount,
    },
    200,
  );
}

export default function Drops() {
  const { recentDrops, currentPage, totalPages, totalCount } =
    useLoaderData<typeof loader>();

  return (
    <Container size="4" mt="3">
      <Flex direction="column" gap="6">
        {/* Header */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="4">
            <Flex justify="center" align="center">
              <Box className="text-center">
                <Heading size="6" className="text-white">
                  Recent Clan Drops
                </Heading>
                <Text size="3" className="text-gray-400">
                  {totalCount} total automated drops
                </Text>
              </Box>
            </Flex>
          </Box>
        </Card>

        {/* Drops List */}
        {recentDrops.length > 0 ? (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <Flex direction="column" gap="2">
                {recentDrops.map(item => (
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
                          <Flex direction="column" gap="1">
                            <Text size="2" className="truncate text-white">
                              {item.osrsData?.name ?? displayItemText(item)}
                            </Text>
                            {item.nickname && (
                              <Text size="1" className="text-gray-500">
                                {item.nickname}
                              </Text>
                            )}
                          </Flex>
                          <Text
                            size="1"
                            className="whitespace-nowrap text-gray-400"
                          >
                            {dayjs(item.createdAt).format('MMM D, YYYY')} •{' '}
                            {item.pointsGiven} pts
                          </Text>
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>
                ))}
              </Flex>

              {totalPages > 1 && (
                <Flex justify="between" align="center" mt="4">
                  {currentPage === 1 ? (
                    <Button variant="soft" disabled>
                      Previous
                    </Button>
                  ) : (
                    <Button asChild variant="soft">
                      <Link to={`?page=${currentPage - 1}`}>Previous</Link>
                    </Button>
                  )}
                  <Text size="2" className="text-gray-400">
                    Page {currentPage} of {totalPages}
                  </Text>
                  {currentPage === totalPages ? (
                    <Button variant="soft" disabled>
                      Next
                    </Button>
                  ) : (
                    <Button asChild variant="soft">
                      <Link to={`?page=${currentPage + 1}`}>Next</Link>
                    </Button>
                  )}
                </Flex>
              )}
            </Box>
          </Card>
        ) : (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <Box className="py-12 text-center">
                <Text size="3" className="text-gray-400">
                  No drops on record
                </Text>
              </Box>
            </Box>
          </Card>
        )}
      </Flex>
    </Container>
  );
}
