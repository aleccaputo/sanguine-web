import { json, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import { getAllPersonalBests } from '~/data/personal-bests';
import { getNicknameMapByDiscordIds } from '~/services/sanguine-service.server';
import {
  buildBossLeaderboards,
  buildCategoryLeaderboards,
  collectParticipantDiscordIds,
  countEntriesByCategory,
  formatScaleLabel,
} from '~/utils/personal-bests';
import { buildBossImageMap } from '~/utils/pb-boss-image.server';
import { StatBox } from '~/components/StatBox';
import { PbTeam, PbTime, rankBadge } from '~/components/PbTeam';

const LEADERBOARD_LIMIT = 5;

export const meta: MetaFunction = () => [
  { title: 'Personal Bests | Sanguine' },
  {
    name: 'description',
    content: "The clan's fastest boss and raid personal best times.",
  },
];

export async function loader() {
  const personalBests = await getAllPersonalBests();

  const categories = buildCategoryLeaderboards(personalBests, LEADERBOARD_LIMIT);
  const entryCounts = countEntriesByCategory(personalBests);
  const bossLeaderboards = buildBossLeaderboards(categories, entryCounts);

  const nameByDiscordId = await getNicknameMapByDiscordIds(
    collectParticipantDiscordIds(personalBests),
  );

  const bossImageByName = buildBossImageMap(
    bossLeaderboards.map(boss => boss.bossName),
  );

  const summary = {
    totalPbs: personalBests.length,
    bossCount: bossLeaderboards.length,
    categoryCount: categories.length,
  };

  return json({ bossLeaderboards, nameByDiscordId, bossImageByName, summary });
}

export default function PersonalBests() {
  const { bossLeaderboards, nameByDiscordId, bossImageByName, summary } =
    useLoaderData<typeof loader>();

  const [query, setQuery] = useState('');

  const filteredBosses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bossLeaderboards;
    return bossLeaderboards.filter(boss =>
      boss.bossName.toLowerCase().includes(needle),
    );
  }, [bossLeaderboards, query]);

  return (
    <Container size="4" mt="3" px="3">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Box className="text-center">
          <Heading size="6" className="text-white">
            Clan Personal Bests
          </Heading>
          <Text size="2" className="text-gray-400">
            The fastest boss and raid times across Sanguine
          </Text>
        </Box>

        {/* Summary */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Flex
              direction={{ initial: 'column', md: 'row' }}
              justify="between"
              gap="4"
            >
              <StatBox
                label="Personal Bests"
                value={summary.totalPbs.toLocaleString()}
              />
              <StatBox label="Bosses & Raids" value={summary.bossCount} />
              <StatBox label="Categories" value={summary.categoryCount} />
            </Flex>
          </Box>
        </Card>

        {bossLeaderboards.length === 0 ? (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5" className="py-12 text-center">
              <Text size="3" className="text-gray-400">
                No personal bests have been submitted yet.
              </Text>
            </Box>
          </Card>
        ) : (
          <>
            {/* Search — matches the "Search members" field on /users (border turns red on focus,
                no default focus ring). */}
            <Box className="relative w-full rounded border border-gray-700 px-2 py-1 focus-within:border-sanguine-red">
              <Flex gap="2" align="center">
                <MagnifyingGlassIcon
                  height="16"
                  width="16"
                  className="text-gray-400"
                />
                <input
                  type="text"
                  className="w-full bg-transparent font-runescape text-white outline-none"
                  placeholder="Search for a boss or raid..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </Flex>
            </Box>

            {filteredBosses.length === 0 ? (
              <Card className="border border-gray-800 bg-gray-900">
                <Box p="5" className="py-12 text-center">
                  <Text size="3" className="text-gray-400">
                    No bosses match “{query}”.
                  </Text>
                </Box>
              </Card>
            ) : (
              filteredBosses.map(boss => (
                <Card
                  key={boss.bossName}
                  className="border border-gray-800 bg-gray-900"
                >
                  <Box p="5">
                    {/* Boss header */}
                    <Flex align="center" gap="3" mb="4">
                      <Box className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
                        <img
                          src={bossImageByName[boss.bossName]}
                          alt={boss.bossName}
                          className="max-h-9 max-w-9 object-contain"
                        />
                      </Box>
                      <Heading size="5" className="text-white">
                        {boss.bossName}
                      </Heading>
                      <Badge color="gray" variant="soft" radius="full">
                        {boss.totalEntries}
                      </Badge>
                    </Flex>

                    <Flex direction="column" gap="5">
                      {boss.categories.map(category => (
                        <Box key={category.categoryKey}>
                          {/* Label the team size/invocation for anything that isn't a plain solo
                              boss — i.e. any raid scale, any invocation, or a boss that has more
                              than one category. A lone solo boss needs no label (the header says it). */}
                          {(boss.categories.length > 1 ||
                            category.scale > 1 ||
                            category.raidLevel != null) && (
                            <Text
                              size="2"
                              weight="medium"
                              className="mb-2 block text-sanguine-red"
                            >
                              {formatScaleLabel(
                                category.scale,
                                category.raidLevel,
                              )}
                            </Text>
                          )}
                          <div className="overflow-x-auto">
                            <Table.Root size="1">
                              <Table.Header>
                                <Table.Row>
                                  <Table.ColumnHeaderCell className="w-12 text-gray-400">
                                    #
                                  </Table.ColumnHeaderCell>
                                  <Table.ColumnHeaderCell className="text-gray-400">
                                    Time
                                  </Table.ColumnHeaderCell>
                                  <Table.ColumnHeaderCell className="text-gray-400">
                                    Team
                                  </Table.ColumnHeaderCell>
                                  <Table.ColumnHeaderCell className="text-gray-400">
                                    Proof
                                  </Table.ColumnHeaderCell>
                                </Table.Row>
                              </Table.Header>
                              <Table.Body>
                                {category.entries.map((entry, index) => (
                                  <Table.Row key={entry.id}>
                                    <Table.Cell className="text-gray-400">
                                      {rankBadge(index + 1)}
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap font-medium text-amber-400">
                                      <PbTime
                                        timeDisplay={entry.timeDisplay}
                                        isPreciseTime={entry.isPreciseTime}
                                      />
                                    </Table.Cell>
                                    <Table.Cell>
                                      <PbTeam
                                        participantDiscordIds={
                                          entry.participantDiscordIds
                                        }
                                        participantAltNames={
                                          entry.participantAltNames
                                        }
                                        nameByDiscordId={nameByDiscordId}
                                      />
                                    </Table.Cell>
                                    <Table.Cell>
                                      {entry.proofMessageUrl ? (
                                        <a
                                          href={entry.proofMessageUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-gray-400 transition-colors hover:text-sanguine-red"
                                        >
                                          View
                                        </a>
                                      ) : (
                                        <Text size="2" className="text-gray-600">
                                          —
                                        </Text>
                                      )}
                                    </Table.Cell>
                                  </Table.Row>
                                ))}
                              </Table.Body>
                            </Table.Root>
                          </div>
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                </Card>
              ))
            )}
          </>
        )}

        {/* Bottom spacer */}
        <Box mb="6" />
      </Flex>
    </Container>
  );
}
