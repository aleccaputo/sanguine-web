import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { Box, Container, Flex } from '@radix-ui/themes';
import { getClanDropsPaginated } from '~/data/points-audit';
import { getAllUserAlts } from '~/data/user';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { DropItem } from '~/components/DropItem';
import { PageHeader } from '~/components/PageHeader';
import { Pagination } from '~/components/Pagination';
import { EmptyState } from '~/components/EmptyState';
import { CoinsIcon } from '~/components/CoinsIcon';
import { zebraRowClass } from '~/utils/styles';
import {
  buildAltsByDiscordId,
  resolveDisplayName,
} from '~/utils/account-matching';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Drop Log' },
    {
      name: 'description',
      content: 'The most recent drops received by Sanguine members',
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 7;

  const [{ drops, totalCount, currentPage, totalPages }, users, allAlts] =
    await Promise.all([
      getClanDropsPaginated(page, pageSize),
      getUsersWithNicknames(),
      getAllUserAlts(),
    ]);

  const altsByDiscordId = buildAltsByDiscordId(allAlts);

  // Fetch OSRS item data for items that have an itemId
  const itemsWithData = await Promise.all(
    drops.map(async item => {
      const user = users.find(u => u.discordId === item.destinationDiscordId);
      const osrsData =
        item.itemId !== null ? await fetchOSRSItem(item.itemId) : null;

      const mainName = user?.nickname ?? user?.discordId ?? '';
      const nickname = resolveDisplayName(
        item.osrsName,
        mainName,
        altsByDiscordId.get(item.destinationDiscordId) ?? new Set(),
      );

      return {
        ...item,
        osrsData,
        nickname,
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
  const [, setSearchParams] = useSearchParams();

  const goToPage = (page: number) => {
    setSearchParams({ page: String(page) });
  };

  // Narrate the page's numbers: the full record count, and what the drops on
  // this page are worth together (clauses drop out when there's nothing to say).
  const pageGP = recentDrops.reduce(
    (sum, item) => sum + (item.osrsData?.price ?? 0),
    0,
  );

  return (
    <Container size="3" mt="3">
      <Flex direction="column">
        <PageHeader
          title="Drop log"
          iconSrc="https://oldschool.runescape.wiki/images/Coins_detail.png"
        >
          <span className="font-semibold text-white">
            {totalCount.toLocaleString()}
          </span>{' '}
          drops on the record
          {pageGP > 0 && (
            <>
              , the {recentDrops.length} shown worth <CoinsIcon />{' '}
              <span className="font-semibold text-osrs-gold">
                {pageGP.toLocaleString()}
              </span>{' '}
              gp
            </>
          )}
        </PageHeader>

        {/* The log itself: flat zebra rows under one committed red rule */}
        <Box className="border-t-2 border-t-sanguine-red">
          {recentDrops.length > 0 ? (
            recentDrops.map(item => (
              <div key={item.id} className={`px-2 ${zebraRowClass}`}>
                <DropItem
                  item={item}
                  nickname={item.nickname}
                  showRecipient={true}
                />
              </div>
            ))
          ) : (
            <EmptyState />
          )}
        </Box>

        <Box mb="6">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPrev={() => goToPage(Math.max(1, currentPage - 1))}
            onNext={() => goToPage(Math.min(totalPages, currentPage + 1))}
          />
        </Box>
      </Flex>
    </Container>
  );
}
