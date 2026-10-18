import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import dayjs from 'dayjs';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
import { getDropAuditsForItems } from '~/data/points-audit';
import { getRaidCompletionsForMetric } from '~/data/raid-completions';
import { getNicknameMapByDiscordIds } from '~/services/sanguine-service.server';
import {
  fetchOSRSItem,
  findItemIdsByNames,
  wikiItemIconUrl,
} from '~/services/osrs-wiki-prices-service';
import {
  boardItemIds,
  CLAN_FIRST_SLOTS,
  firstUniquePlayers,
  rankClearsWithNetNew,
  TFA_DISPLAY_NAME,
  TFA_DROP_BOARDS,
  TFA_METRIC,
  TFA_RELEASE_ISO,
} from '~/utils/clan-firsts';
import { PbTeam, rankBadge } from '~/components/PbTeam';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading } from '~/components/SectionHeading';
import { proseLinkClass, zebraRowClass } from '~/utils/styles';

export const meta: MetaFunction = () => [
  { title: `${TFA_DISPLAY_NAME} Clan Firsts | Sanguine` },
  {
    name: 'description',
    content: `The first Sanguine teams to clear ${TFA_DISPLAY_NAME}, and the first members to receive each of its uniques.`,
  },
];

export async function loader() {
  const [idsByName, clears] = await Promise.all([
    findItemIdsByNames(TFA_DROP_BOARDS.flatMap(board => board.itemNames)),
    getRaidCompletionsForMetric(TFA_METRIC, TFA_RELEASE_ISO),
  ]);
  const idsByBoard = TFA_DROP_BOARDS.map(board =>
    boardItemIds(board, idsByName),
  );
  const audits = await getDropAuditsForItems(
    [...new Set(idsByBoard.flat())],
    TFA_RELEASE_ISO,
  );

  const dropBoards = await Promise.all(
    TFA_DROP_BOARDS.map(async (board, index) => {
      const itemIds = idsByBoard[index];
      const firstItem =
        itemIds[0] != null ? await fetchOSRSItem(itemIds[0]) : null;
      const fallbackIcon =
        board.itemNames.length > 0
          ? wikiItemIconUrl(board.itemNames[0])
          : '/sanguine_icon.png';
      return {
        key: board.key,
        displayName: board.displayName,
        icon: firstItem?.icon ?? fallbackIcon,
        placements: firstUniquePlayers(
          audits.filter(
            audit => audit.itemId != null && itemIds.includes(audit.itemId),
          ),
        ),
      };
    }),
  );
  const clearPlacements = rankClearsWithNetNew(clears);

  const nameByDiscordId = await getNicknameMapByDiscordIds([
    ...new Set([
      ...clearPlacements.flatMap(p => [
        ...p.creditedDiscordIds,
        ...p.alreadyPlacedDiscordIds,
      ]),
      ...dropBoards.flatMap(board => board.placements.map(p => p.discordId)),
    ]),
  ]);

  return json(
    { clearPlacements, dropBoards, nameByDiscordId },
    { headers: { 'Cache-Control': 'max-age=120' } },
  );
}

const formatDate = (iso: string) => dayjs(iso).format('MMM D, YYYY');

const slotRows = <T,>(placements: T[]) =>
  Array.from({ length: CLAN_FIRST_SLOTS }, (_, index) => placements[index]);

export default function ClanFirsts() {
  const { clearPlacements, dropBoards, nameByDiscordId } =
    useLoaderData<typeof loader>();

  return (
    <Container size="3" mt="3">
      <Flex direction="column" gap="6">
        <PageHeader
          title={`${TFA_DISPLAY_NAME} clan firsts`}
          iconSrc="/sanguine_icon_small.png"
        />

        <section>
          <SectionHeading title="First clears" />
          <Table.Root size="2" mt="2">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className="w-12 text-osrs-orange">
                  #
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-osrs-orange">
                  Team
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-osrs-orange">
                  Date
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {slotRows(clearPlacements).map((placement, index) => (
                <Table.Row key={index} className={zebraRowClass}>
                  <Table.Cell>{rankBadge(index + 1)}</Table.Cell>
                  <Table.Cell>
                    {placement ? (
                      <>
                        <PbTeam
                          participantDiscordIds={placement.creditedDiscordIds}
                          nameByDiscordId={nameByDiscordId}
                        />
                        {placement.alreadyPlacedDiscordIds.length > 0 && (
                          <Text as="p" size="1" className="text-gray-500">
                            with{' '}
                            {placement.alreadyPlacedDiscordIds
                              .map(id => nameByDiscordId[id] ?? 'Unknown')
                              .sort((a, b) => a.localeCompare(b))
                              .join(', ')}{' '}
                            (already placed)
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text size="2" className="text-gray-600">
                        Unclaimed
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {placement && (
                      <Text size="2" className="text-gray-400">
                        {placement.proofMessageUrl ? (
                          <a
                            href={placement.proofMessageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={proseLinkClass}
                          >
                            {formatDate(placement.achievedAt)}
                          </a>
                        ) : (
                          formatDate(placement.achievedAt)
                        )}
                      </Text>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </section>

        <section>
          <SectionHeading title="First drops" />
          <Box className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dropBoards.map(board => (
              <Box
                key={board.key}
                className="rounded-sm border border-sanguine-red/[0.18] bg-sanguine-red/[0.05] p-3"
              >
                <Flex align="center" gap="2" mb="2">
                  <Box className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <img
                      src={board.icon}
                      alt=""
                      className="max-h-8 max-w-8 object-contain"
                    />
                  </Box>
                  <Text size="3" className="text-osrs-orange">
                    {board.displayName}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  {slotRows(board.placements).map((placement, index) => (
                    <Flex key={index} justify="between" gap="2">
                      <Text size="2" className="text-gray-300">
                        <span className="inline-block w-7">
                          {rankBadge(index + 1)}
                        </span>
                        {placement ? (
                          nameByDiscordId[placement.discordId] ? (
                            <Link
                              to={`/users/${placement.discordId}`}
                              className="text-sanguine-bright transition-colors hover:text-white"
                            >
                              {nameByDiscordId[placement.discordId]}
                            </Link>
                          ) : (
                            placement.osrsName ?? 'Unknown'
                          )
                        ) : (
                          <span className="text-gray-600">Unclaimed</span>
                        )}
                      </Text>
                      {placement && (
                        <Text size="2" className="text-gray-500">
                          {formatDate(placement.achievedAt)}
                        </Text>
                      )}
                    </Flex>
                  ))}
                </Flex>
              </Box>
            ))}
          </Box>
        </section>
      </Flex>
    </Container>
  );
}
