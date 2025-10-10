import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import {
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Button,
} from '@radix-ui/themes';
import { getClanDropsPaginated } from '~/data/points-audit';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { DropItem } from '~/components/DropItem';

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
  const pageSize = 7;

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
        item.itemId !== null ? await fetchOSRSItem(item.itemId) : null;

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
      <Flex direction="column" gap="4">
        {/* Header */}
        <Box className="text-center">
          <Heading size="6" className="text-white">
            Recent Clan Drops
          </Heading>
          <Text size="2" className="text-gray-400">
            {totalCount} total drops
          </Text>
        </Box>

        {/* Drops List */}
        {recentDrops.length > 0 ? (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="4">
              <Flex direction="column">
                {recentDrops.map(item => (
                  <DropItem
                    key={item.id}
                    item={item}
                    nickname={item.nickname}
                    showRecipient={true}
                  />
                ))}
              </Flex>
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

        {totalPages > 1 && (
          <Flex justify="between" align="center" mt="2" mb="6">
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
      </Flex>
    </Container>
  );
}
