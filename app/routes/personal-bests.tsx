import { json, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
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
import { PbTeam, PbTime, rankBadge } from '~/components/PbTeam';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { StickyToolbar, SearchInput } from '~/components/StickyToolbar';
import { EmptyState } from '~/components/EmptyState';
import { zebraRowClass } from '~/utils/styles';

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

  const categories = buildCategoryLeaderboards(
    personalBests,
    LEADERBOARD_LIMIT,
  );
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
    <Container size="3" mt="3">
      <Flex direction="column">
        <PageHeader title="Personal bests" iconSrc="/sanguine_icon_small.png">
          <span className="font-semibold text-white">
            {summary.totalPbs.toLocaleString()}
          </span>{' '}
          record times held across{' '}
          <span className="font-semibold text-white">{summary.bossCount}</span>{' '}
          bosses and raids in{' '}
          <span className="font-semibold text-white">
            {summary.categoryCount}
          </span>{' '}
          categories
        </PageHeader>

        {bossLeaderboards.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <StickyToolbar>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search for a boss or raid..."
                className="w-72"
              />
            </StickyToolbar>

            {filteredBosses.length === 0 ? (
              <EmptyState />
            ) : (
              filteredBosses.map(boss => (
                <section key={boss.bossName} className="mt-8">
                  <SectionHeading
                    title={
                      <Flex align="center" gap="2" className="min-w-0">
                        <Box className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                          <img
                            src={bossImageByName[boss.bossName]}
                            alt=""
                            className="max-h-8 max-w-8 object-contain"
                          />
                        </Box>
                        <span className="min-w-0 truncate">
                          {boss.bossName}
                        </span>
                      </Flex>
                    }
                    summary={
                      <Text
                        size="2"
                        className="whitespace-nowrap text-gray-500"
                      >
                        <span className="text-white">{boss.totalEntries}</span>{' '}
                        {boss.totalEntries === 1 ? 'time' : 'times'}
                      </Text>
                    }
                  />

                  <Flex direction="column" gap="4" mt="2">
                    {boss.categories.map(category => (
                      <Box key={category.categoryKey}>
                        {/* Label the team size/invocation for anything that isn't a plain solo
                            boss — i.e. any raid scale, any invocation, or a boss that has more
                            than one category. A lone solo boss needs no label (the header says it). */}
                        {(boss.categories.length > 1 ||
                          category.scale > 1 ||
                          category.raidLevel != null) && (
                          <SubsectionHeading
                            title={formatScaleLabel(
                              category.scale,
                              category.raidLevel,
                            )}
                          />
                        )}
                        <div className="overflow-x-auto">
                          <Table.Root size="2">
                            <Table.Header>
                              <Table.Row>
                                <Table.ColumnHeaderCell className="w-12 text-osrs-orange">
                                  #
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell className="text-osrs-orange">
                                  Time
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell className="text-osrs-orange">
                                  Team
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                                  Proof
                                </Table.ColumnHeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {category.entries.map((entry, index) => (
                                <Table.Row
                                  key={entry.id}
                                  className={zebraRowClass}
                                >
                                  <Table.Cell className="whitespace-nowrap text-white">
                                    {rankBadge(index + 1)}
                                  </Table.Cell>
                                  <Table.Cell className="whitespace-nowrap font-medium text-osrs-gold">
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
                                  <Table.Cell className="hidden sm:table-cell">
                                    {entry.proofMessageUrl ? (
                                      <a
                                        href={entry.proofMessageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-gray-400 transition-colors hover:text-sanguine-bright"
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
                </section>
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
