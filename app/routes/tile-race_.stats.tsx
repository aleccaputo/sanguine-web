import { useState } from 'react';
import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
import { getCurrentTileRace } from '~/services/tile-race-service.server';
import { getLatestAdminRace } from '~/services/events-admin-service.server';
import { getNicknameMapByDiscordIds } from '~/services/sanguine-service.server';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading } from '~/components/SectionHeading';
import { EmptyState } from '~/components/EmptyState';
import { ILeaderBoard, LeaderBand } from '~/components/LeaderBand';
import {
  SortableHeaderCell,
  SortConfig,
} from '~/components/SortableHeaderCell';
import { TeamToken } from '~/components/TeamToken';
import { assignTeamColors, godSymbolSrc } from '~/utils/tile-race-teams';
import {
  proseLinkClass,
  zebraRowClass,
  zebraStripeClass,
} from '~/utils/styles';
import { getTileImageUrl } from '~/utils/tile-race-images';
import {
  distinct,
  dropsForStanding,
  groupDropsByTile,
  IMemberDropTally,
  IRaceDrop,
  tallyDropsByMember,
  tallyDropsByTeam,
} from '~/utils/tile-race-stats';

export const meta: MetaFunction = () => [
  { title: 'Tile Race Stats' },
  {
    name: 'description',
    content:
      'Who got what on the Sanguine tile race: approved drops by member, team, and task.',
  },
];

export async function loader() {
  // The admin read carries rosters and a submitter per approved drop, and (unlike
  // /races/current) keeps serving the last completed race after it ends. Falls
  // back to the public payload — one anonymous closer per cleared tile — if the
  // service token is missing or the API predates the latest-race route.
  const adminRace = await getLatestAdminRace().catch(() => null);
  const race = adminRace ?? (await getCurrentTileRace().catch(() => null));
  if (!race || race.event.status === 'DRAFT') {
    return json({ stats: null });
  }
  const rawDrops = race.standings.flatMap(standing =>
    dropsForStanding(standing).map(drop => ({
      ...drop,
      teamId: standing.teamId,
    })),
  );
  // Submitter ids resolve to clan nicknames here; a submitter the clan records
  // don't know stays nameless in the UI.
  const nameByDiscordId = await getNicknameMapByDiscordIds(
    distinct(rawDrops.map(drop => drop.submittedByDiscordId)),
  );
  const drops: IRaceDrop[] = rawDrops.map(
    ({ submittedByDiscordId, ...drop }) => ({
      ...drop,
      memberId: submittedByDiscordId,
      memberName: submittedByDiscordId
        ? nameByDiscordId[submittedByDiscordId] ?? null
        : null,
    }),
  );
  return json({
    stats: {
      event: race.event,
      tiered: race.board.mode === 'TIERED',
      tierSizes: race.board.tierSizes ?? [],
      tasks: race.board.tiles
        .filter(tile => tile.type === 'TASK')
        .map(tile => ({
          index: tile.index,
          name: tile.name ?? `Tile ${tile.index}`,
          imageUrl:
            tile.imageUrl ?? getTileImageUrl(tile.name, tile.description),
          quantity: tile.quantity ?? 1,
          tier: tile.tier ?? null,
        })),
      teams: race.standings.map(standing => ({
        teamId: standing.teamId,
        name: standing.name,
        place: standing.place,
      })),
      drops,
    },
  });
}

type SortKey = 'name' | 'team' | 'drops' | 'latest';

interface ITaskView {
  index: number;
  name: string;
  imageUrl: string | null;
  quantity: number;
  tier: number | null;
}

// UTC pinned so the server render and every viewer's hydration agree on the date.
const formatDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '';

const formatDateRange = (start: string, end: string): string =>
  `${formatDate(start)} to ${new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;

const plural = (count: number, noun: string): string =>
  `${noun}${count === 1 ? '' : 's'}`;

/** 24px task artwork beside a task name; unmounts if the guessed wiki image 404s. */
function TaskArt({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return null;
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={24}
      height={24}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-6 w-6 shrink-0 object-contain [image-rendering:pixelated]"
    />
  );
}

/** A submitter's name: red and linked when the clan records know them, else gray. */
function MemberName({
  memberId,
  memberName,
}: {
  memberId: string | null;
  memberName: string | null;
}) {
  if (memberId && memberName) {
    return (
      <Link to={`/users/${memberId}`} className={`text-sm ${proseLinkClass}`}>
        {memberName}
      </Link>
    );
  }
  return (
    <Text size="2" className="text-gray-500">
      {memberName ?? 'Unknown'}
    </Text>
  );
}

export default function TileRaceStats() {
  const { stats } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortConfig<SortKey>>({
    key: 'drops',
    direction: 'desc',
  });

  if (!stats) {
    return (
      <Container size="4" mt="3" pb="6" px="4">
        <PageHeader title="Tile race stats" iconSrc="/sanguine_icon_small.png">
          Approved drops by member, team, and task. No race to tally yet.
        </PageHeader>
        <EmptyState>You check the log… nothing interesting happens.</EmptyState>
      </Container>
    );
  }

  const { event, tiered, tierSizes, tasks, teams, drops } = stats;
  const colorByTeamId = assignTeamColors(teams);
  const teamName = (teamId: string): string =>
    teams.find(team => team.teamId === teamId)?.name ?? 'Unknown team';
  const byMember = tallyDropsByMember(drops);
  // Public-payload fallback knows no submitters at all — then the member views
  // have nothing to say and drop out.
  const knownMembers = byMember.filter(member => member.memberName);
  const hasSubmitters = knownMembers.length > 0;
  const rankByKey = Object.fromEntries(
    knownMembers.map((member, i) => [member.key, i + 1]),
  );
  const byTeam = tallyDropsByTeam(drops);
  const byTile = groupDropsByTile(drops);
  const dropsOn = (task: ITaskView): IRaceDrop[] => byTile[task.index] ?? [];
  const tasksWithDrops = tasks.filter(task => dropsOn(task).length > 0);
  const winner = teams.find(team => team.place === 1);
  const running = event.status === 'ACTIVE';

  // Tiered boards group tasks under a tier heading; classic boards read as one list.
  const tierGroups: { tier: number | null; tasks: ITaskView[] }[] =
    tiered && tierSizes.length >= 2
      ? tierSizes.map((_, i) => ({
          tier: i + 1,
          tasks: tasks.filter(task => task.tier === i + 1),
        }))
      : [{ tier: null, tasks }];

  const toggleSort = (key: SortKey) =>
    setSort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' || key === 'team' ? 'asc' : 'desc' },
    );
  const sortedMembers = [...knownMembers].sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const nameOrder = (a.memberName ?? '').localeCompare(b.memberName ?? '');
    const dropsTiebreak = b.drops - a.drops;
    switch (sort.key) {
      case 'name':
        return direction * nameOrder || dropsTiebreak;
      case 'team':
        return (
          direction * teamName(a.teamId).localeCompare(teamName(b.teamId)) ||
          dropsTiebreak
        );
      case 'latest':
        return (
          direction * (a.latestAt ?? '').localeCompare(b.latestAt ?? '') ||
          dropsTiebreak
        );
      case 'drops':
        return direction * (a.drops - b.drops) || nameOrder;
    }
  });

  const memberBoard: ILeaderBoard[] = hasSubmitters
    ? [
        {
          key: 'members',
          title: 'Most drops',
          valueClassName: 'text-gray-100',
          entries: knownMembers.slice(0, 3).map(member => ({
            key: member.key,
            iconSrc: godSymbolSrc(colorByTeamId[member.teamId]),
            iconAlt: teamName(member.teamId),
            label: member.memberName ?? '',
            value: String(member.drops),
            onClick: member.memberId
              ? () => navigate(`/users/${member.memberId}`)
              : undefined,
          })),
        },
      ]
    : [];
  const boards: ILeaderBoard[] = [
    ...memberBoard,
    {
      key: 'teams',
      title: 'Drops by team',
      valueClassName: 'text-gray-100',
      entries: [...teams]
        .sort((a, b) => (byTeam[b.teamId] ?? 0) - (byTeam[a.teamId] ?? 0))
        .slice(0, 3)
        .map(team => ({
          key: team.teamId,
          iconSrc: godSymbolSrc(colorByTeamId[team.teamId]),
          iconAlt: '',
          label: team.name,
          value: String(byTeam[team.teamId] ?? 0),
        })),
    },
    {
      key: 'tasks',
      title: 'Most submitted tasks',
      valueClassName: 'text-gray-100',
      entries: [...tasksWithDrops]
        .sort((a, b) => dropsOn(b).length - dropsOn(a).length)
        .slice(0, 3)
        .map(task => ({
          key: String(task.index),
          iconSrc: task.imageUrl ?? '/sanguine_icon_small.png',
          iconAlt: '',
          label: task.name,
          value: String(dropsOn(task).length),
        })),
    },
  ];

  const log = [...drops].sort((a, b) =>
    (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''),
  );

  return (
    <Container size="4" mt="3" pb="6" px="4">
      <PageHeader title="Tile race stats" iconSrc="/sanguine_icon_small.png">
        <Link to="/tile-race" className={proseLinkClass}>
          {event.name}
        </Link>{' '}
        {running ? 'runs' : 'ran'}{' '}
        {formatDateRange(event.startDate, event.endDate)}.{' '}
        <span className="text-gray-100">{drops.length}</span> approved{' '}
        {plural(drops.length, 'drop')} across{' '}
        <span className="text-gray-100">{tasksWithDrops.length}</span>{' '}
        {plural(tasksWithDrops.length, 'task')}
        {hasSubmitters && (
          <>
            , from <span className="text-gray-100">{knownMembers.length}</span>{' '}
            {plural(knownMembers.length, 'member')}
          </>
        )}{' '}
        of <span className="text-gray-100">{teams.length}</span>{' '}
        {plural(teams.length, 'team')}
        {winner && (
          <>
            ; <span className="text-gray-100">{winner.name}</span> crossed the
            line first
          </>
        )}
        .
      </PageHeader>

      {drops.length === 0 ? (
        <EmptyState>No approved drops yet.</EmptyState>
      ) : (
        <>
          <LeaderBand boards={boards} />

          <Flex direction="column" gap="6">
            {hasSubmitters && (
              <Box>
                <SectionHeading
                  title="Members"
                  summary={
                    <Text size="2" className="text-gray-500">
                      {knownMembers.length}{' '}
                      {plural(knownMembers.length, 'member')} with an approved
                      drop
                    </Text>
                  }
                />
                <Table.Root size="2" mt="2">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell className="w-10 text-osrs-orange">
                        #
                      </Table.ColumnHeaderCell>
                      <SortableHeaderCell
                        label="Member"
                        columnKey="name"
                        activeSort={sort}
                        onToggle={() => toggleSort('name')}
                      />
                      <SortableHeaderCell
                        label="Team"
                        columnKey="team"
                        activeSort={sort}
                        onToggle={() => toggleSort('team')}
                        className="hidden sm:table-cell"
                      />
                      <SortableHeaderCell
                        label="Drops"
                        columnKey="drops"
                        activeSort={sort}
                        onToggle={() => toggleSort('drops')}
                        align="right"
                      />
                      <SortableHeaderCell
                        label="Last drop"
                        columnKey="latest"
                        activeSort={sort}
                        onToggle={() => toggleSort('latest')}
                        align="right"
                        className="hidden md:table-cell"
                      />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sortedMembers.map((member: IMemberDropTally) => (
                      <Table.Row key={member.key} className={zebraRowClass}>
                        <Table.Cell>
                          <Text size="2" className="text-gray-500">
                            {rankByKey[member.key]}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <MemberName
                            memberId={member.memberId}
                            memberName={member.memberName}
                          />
                        </Table.Cell>
                        <Table.Cell className="hidden sm:table-cell">
                          <Flex align="center" gap="2">
                            <TeamToken
                              name={teamName(member.teamId)}
                              color={colorByTeamId[member.teamId]}
                              size="sm"
                            />
                            <Text size="2" className="text-gray-300">
                              {teamName(member.teamId)}
                            </Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Text size="2" className="text-gray-100">
                            {member.drops}
                          </Text>
                        </Table.Cell>
                        <Table.Cell
                          justify="end"
                          className="hidden md:table-cell"
                        >
                          <Text
                            size="2"
                            className="whitespace-nowrap text-gray-500"
                          >
                            {formatDate(member.latestAt)}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}

            <Box>
              <SectionHeading
                title="Tasks"
                summary={
                  <Text size="2" className="text-gray-500">
                    {tasksWithDrops.length} of {tasks.length}{' '}
                    {plural(tasks.length, 'task')} got a drop
                  </Text>
                }
              />
              <Table.Root size="2" mt="2">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell className="text-osrs-orange">
                      Task
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className="w-16 text-osrs-orange sm:w-28">
                      Teams
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell md:w-2/5">
                      Members
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      justify="end"
                      className="w-12 text-osrs-orange sm:w-16"
                    >
                      Drops
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {tierGroups.flatMap(group => {
                    const tierDrops = group.tasks.reduce(
                      (sum, task) => sum + dropsOn(task).length,
                      0,
                    );
                    // One table for every tier keeps the columns aligned; a
                    // spanning row plays the tier's h3 (bare orange, no rule).
                    const tierRow =
                      group.tier !== null
                        ? [
                            <Table.Row key={`tier-${group.tier}`}>
                              <Table.Cell colSpan={4} className="pt-4">
                                <Flex
                                  justify="between"
                                  align="baseline"
                                  gap="3"
                                >
                                  <Text size="3" className="text-osrs-orange">
                                    Tier {group.tier}{' '}
                                    <span className="hidden text-gray-600 sm:inline">
                                      rolls a d{tierSizes[group.tier - 1]}
                                    </span>
                                  </Text>
                                  <Text size="2" className="text-gray-500">
                                    {tierDrops} {plural(tierDrops, 'drop')}
                                  </Text>
                                </Flex>
                              </Table.Cell>
                            </Table.Row>,
                          ]
                        : [];
                    const taskRows = group.tasks.map(task => {
                      const dropsHere = dropsOn(task);
                      const teamsHere = distinct(
                        dropsHere.map(drop => drop.teamId),
                      );
                      const membersHere = tallyDropsByMember(dropsHere);
                      return (
                        <Table.Row
                          key={task.index}
                          className={zebraStripeClass}
                        >
                          <Table.Cell>
                            <Flex align="center" gap="2">
                              {task.imageUrl && <TaskArt src={task.imageUrl} />}
                              <Text
                                size="2"
                                className={
                                  dropsHere.length
                                    ? 'text-gray-200'
                                    : 'text-gray-600'
                                }
                              >
                                {task.name}
                                {task.quantity > 1 && (
                                  <span className="text-osrs-gold">
                                    {' '}
                                    ×{task.quantity}
                                  </span>
                                )}
                              </Text>
                            </Flex>
                          </Table.Cell>
                          <Table.Cell>
                            {teamsHere.length > 0 && (
                              <Flex
                                align="center"
                                className={
                                  teamsHere.length > 3
                                    ? '-space-x-1.5'
                                    : 'flex-wrap gap-1'
                                }
                              >
                                {teamsHere.map(teamId => (
                                  <TeamToken
                                    key={teamId}
                                    name={teamName(teamId)}
                                    color={colorByTeamId[teamId]}
                                    size="sm"
                                  />
                                ))}
                              </Flex>
                            )}
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <Text size="2" className="text-gray-500">
                              {membersHere.map((member, i) => (
                                <span key={member.key}>
                                  <MemberName
                                    memberId={member.memberId}
                                    memberName={member.memberName}
                                  />
                                  {member.drops > 1 && (
                                    <span className="text-gray-500">
                                      {' '}
                                      ×{member.drops}
                                    </span>
                                  )}
                                  {i < membersHere.length - 1 && ', '}
                                </span>
                              ))}
                            </Text>
                          </Table.Cell>
                          <Table.Cell justify="end">
                            <Text
                              size="2"
                              className={
                                dropsHere.length
                                  ? 'text-gray-100'
                                  : 'text-gray-600'
                              }
                            >
                              {dropsHere.length}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      );
                    });
                    return [...tierRow, ...taskRows];
                  })}
                </Table.Body>
              </Table.Root>
            </Box>

            <Box>
              <SectionHeading
                title="Drop log"
                summary={
                  <Text size="2" className="text-gray-500">
                    every approved submission, newest first
                  </Text>
                }
              />
              <Table.Root size="2" mt="2">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell className="w-20 text-osrs-orange">
                      Date
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className="text-osrs-orange">
                      Team
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className="text-osrs-orange">
                      Drop
                    </Table.ColumnHeaderCell>
                    {hasSubmitters && (
                      <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                        Member
                      </Table.ColumnHeaderCell>
                    )}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {log.map((drop, i) => (
                    <Table.Row
                      key={`${drop.teamId}-${drop.tileIndex}-${i}`}
                      className={zebraStripeClass}
                    >
                      <Table.Cell>
                        <Text
                          size="2"
                          className="whitespace-nowrap text-gray-500"
                        >
                          {formatDate(drop.approvedAt)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <TeamToken
                            name={teamName(drop.teamId)}
                            color={colorByTeamId[drop.teamId]}
                            size="sm"
                          />
                          <Text
                            size="2"
                            className="hidden text-gray-100 sm:inline"
                          >
                            {teamName(drop.teamId)}
                          </Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" className="text-gray-200">
                          {tasks.find(task => task.index === drop.tileIndex)
                            ?.name ?? `Tile ${drop.tileIndex}`}
                          {drop.note && (
                            <span className="text-gray-400">
                              {' '}
                              “{drop.note}”
                            </span>
                          )}
                        </Text>
                      </Table.Cell>
                      {hasSubmitters && (
                        <Table.Cell className="hidden md:table-cell">
                          <MemberName
                            memberId={drop.memberId}
                            memberName={drop.memberName}
                          />
                        </Table.Cell>
                      )}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Flex>
        </>
      )}
    </Container>
  );
}
