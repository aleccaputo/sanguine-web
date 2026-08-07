import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import { useState } from 'react';
import dayjs from 'dayjs';
import { Box, Container, Flex, Text } from '@radix-ui/themes';
import { getSlayerLog } from '~/services/slayer-service.server';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getClanFromWom } from '~/services/wom-api-service.server';
import { fetchRankImage, rankLabel } from '~/utils/clan-ranks';
import { PageHeader } from '~/components/PageHeader';
import { LeaderBand, ILeaderBoard } from '~/components/LeaderBand';
import { SectionHeading } from '~/components/SectionHeading';
import { SortableHeaderButton } from '~/components/SortableHeaderButton';
import { CoinsIcon } from '~/components/CoinsIcon';
import { EmptyState } from '~/components/EmptyState';
import { Pagination } from '~/components/Pagination';
import {
  proseLinkClass,
  zebraRowClass,
  zebraStripeClass,
} from '~/utils/styles';
import { formatGp, SLAYER_ICON, WHEEL_MODE } from '~/utils/slayer';
import { usePagination } from '~/utils/use-pagination';

type SortField = 'tasks' | 'name' | 'clanPoints' | 'bonusPoints' | 'loot';
type SortDirection = 'asc' | 'desc';

// Columns that only fit once the table has the full page width (md) or the wide split (xl).
const WIDE_COLUMN_CLASS = 'hidden justify-end md:flex lg:hidden xl:flex';
const WIDE_CELL_CLASS = 'hidden md:block lg:hidden xl:block';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Slayer' },
    {
      name: 'description',
      content:
        'The Sanguine Slayer task log: boss tasks assigned, the drops that completed them, and the clan points they paid.',
    },
  ];
};

export async function loader() {
  const [log, users, womMembers] = await Promise.all([
    getSlayerLog(),
    getUsersWithNicknames(),
    getClanFromWom(),
  ]);

  // Slayer rows key off discordId; names and rank icons come from the roster, the same
  // bridge every other page uses.
  const roleByName = new Map(
    womMembers.map(member => [
      member.player.displayName.toLocaleLowerCase(),
      member.role,
    ]),
  );
  const members = Object.fromEntries(
    users
      .filter(user => user.nickname)
      .map(user => [
        user.discordId,
        {
          nickname: user.nickname ?? '',
          role:
            roleByName.get((user.nickname ?? '').toLocaleLowerCase()) ??
            'Guest',
        },
      ]),
  );

  return json(
    { ...log, members },
    { headers: { 'Cache-Control': 'max-age=300' } },
  );
}

export default function Slayer() {
  const {
    liveWheel,
    rulesWheel,
    completions,
    activeTasks,
    tasksAssigned,
    tasksAbandoned,
    members,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('tasks');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // One row per member who has ever been assigned a task that mattered: everyone with a
  // completion, plus everyone out on task right now.
  const slayers = [
    ...completions
      .reduce((rows, completion) => {
        const row = rows.get(completion.discordId) ?? {
          discordId: completion.discordId,
          tasks: 0,
          clanPoints: 0,
          bonusPoints: 0,
          loot: 0,
        };
        return rows.set(completion.discordId, {
          ...row,
          tasks: row.tasks + 1,
          clanPoints: row.clanPoints + completion.clanPoints,
          bonusPoints: row.bonusPoints + completion.bonusPoints,
          loot: row.loot + completion.itemValue,
        });
      }, new Map<string, { discordId: string; tasks: number; clanPoints: number; bonusPoints: number; loot: number }>())
      .values(),
    ...activeTasks
      .filter(task => !completions.some(c => c.discordId === task.discordId))
      .map(task => ({
        discordId: task.discordId,
        tasks: 0,
        clanPoints: 0,
        bonusPoints: 0,
        loot: 0,
      })),
  ].map(row => {
    const member = members[row.discordId];
    return {
      ...row,
      // Members who left keep their record; the roster just can't name them.
      name: member?.nickname ?? 'Former member',
      role: member?.role ?? 'Guest',
      isMember: member !== undefined,
      activeTask:
        activeTasks.find(task => task.discordId === row.discordId) ?? null,
    };
  });

  const totalTasks = completions.length;
  const totalClanPoints = completions.reduce((sum, c) => sum + c.clanPoints, 0);
  const totalBonusPoints = completions.reduce(
    (sum, c) => sum + c.bonusPoints,
    0,
  );
  const totalLoot = completions.reduce((sum, c) => sum + c.itemValue, 0);
  // The bonus column only earns its width once a competition has actually paid one.
  const hasBonus = totalBonusPoints > 0;

  const navigateToUser = (discordId: string, isMember: boolean) => {
    if (!isMember) return;
    navigate(`/users/${discordId}`);
  };

  const sortedSlayers = [...slayers].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const tasksTiebreak = b.tasks - a.tasks;
    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name) || tasksTiebreak;
      case 'clanPoints':
        return direction * (a.clanPoints - b.clanPoints) || tasksTiebreak;
      case 'bonusPoints':
        return direction * (a.bonusPoints - b.bonusPoints) || tasksTiebreak;
      case 'loot':
        return direction * (a.loot - b.loot) || tasksTiebreak;
      case 'tasks':
      default:
        return direction * (a.tasks - b.tasks) || b.clanPoints - a.clanPoints;
    }
  });

  const onSortColumn = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(direction => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    // Every column but the name leads with the biggest grinders.
    setSortDirection(field === 'name' ? 'asc' : 'desc');
  };

  const completionsPagination = usePagination(completions, 10);

  const leaderBoards: ILeaderBoard[] = [
    {
      key: 'tasks',
      title: 'Most tasks completed',
      valueClassName: 'text-white',
      entries: [...slayers]
        .sort((a, b) => b.tasks - a.tasks || b.loot - a.loot)
        .slice(0, 3)
        .map(row => ({
          key: row.discordId,
          iconSrc: fetchRankImage(row.role),
          iconAlt: rankLabel(row.role),
          label: row.name,
          value: row.tasks.toLocaleString(),
          onClick: row.isMember
            ? () => navigateToUser(row.discordId, row.isMember)
            : undefined,
        })),
    },
    {
      key: 'loot',
      title: 'Most valuable task loot',
      valueClassName: 'text-osrs-gold',
      entries: [...slayers]
        .sort((a, b) => b.loot - a.loot || b.tasks - a.tasks)
        .slice(0, 3)
        .map(row => ({
          key: row.discordId,
          iconSrc: fetchRankImage(row.role),
          iconAlt: rankLabel(row.role),
          label: row.name,
          value: `${formatGp(row.loot)} gp`,
          onClick: row.isMember
            ? () => navigateToUser(row.discordId, row.isMember)
            : undefined,
        })),
    },
  ];

  const sortColumns: {
    field: SortField;
    label: string;
    align: 'left' | 'right';
    className: string;
  }[] = [
    { field: 'name', label: 'Slayer', align: 'left', className: '' },
    {
      field: 'tasks',
      label: 'Tasks',
      align: 'right',
      className: 'justify-end',
    },
    ...(hasBonus
      ? [
          {
            field: 'bonusPoints' as const,
            label: 'Bonus pts',
            align: 'right' as const,
            className: WIDE_COLUMN_CLASS,
          },
        ]
      : []),
    {
      field: 'clanPoints',
      label: 'Clan pts',
      align: 'right',
      className: 'justify-end',
    },
    {
      field: 'loot',
      label: 'Loot',
      align: 'right',
      className: WIDE_COLUMN_CLASS,
    },
  ];

  // Three tiers, because the table shares its row with the completions feed at lg: phones get
  // name/tasks/clan points, md widens to the full set, and lg drops back to the compact set
  // until xl has room for everything again.
  const rowGridClass = hasBonus
    ? 'grid grid-cols-[24px_1fr_52px_64px] items-center gap-2 px-2 md:grid-cols-[40px_1fr_76px_88px_88px_104px] md:gap-3 md:px-3 lg:grid-cols-[28px_1fr_60px_76px] lg:gap-2 lg:px-2 xl:grid-cols-[28px_1fr_60px_76px_76px_84px]'
    : 'grid grid-cols-[24px_1fr_52px_64px] items-center gap-2 px-2 md:grid-cols-[40px_1fr_88px_88px_112px] md:gap-3 md:px-3 lg:grid-cols-[28px_1fr_68px_80px] lg:gap-2 lg:px-2 xl:grid-cols-[28px_1fr_68px_80px_92px]';

  const isCompetition = liveWheel?.mode === WHEEL_MODE.EVENT;

  return (
    <Container size="4" mt="3" pb="6">
      <Flex direction="column">
        <PageHeader title="Slayer" iconSrc={SLAYER_ICON}>
          The Slayer Master assigns a random boss, and any point-worthy drop
          from it completes the task.{' '}
          {totalTasks > 0 ? (
            <>
              <span className="font-semibold text-sanguine-bright">
                {slayers.filter(row => row.tasks > 0).length}
              </span>{' '}
              members have finished{' '}
              <span className="font-semibold text-white">
                {totalTasks.toLocaleString()}
              </span>{' '}
              {totalTasks === 1 ? 'task' : 'tasks'} between them
              {totalClanPoints > 0 && (
                <>
                  {', worth '}
                  <span className="font-semibold text-osrs-gold">
                    {totalClanPoints.toLocaleString()}
                  </span>{' '}
                  clan points
                </>
              )}
              {totalLoot > 0 && (
                <>
                  {' and '}
                  <span className="font-semibold text-osrs-gold">
                    {totalLoot.toLocaleString()} gp
                  </span>{' '}
                  of loot
                </>
              )}
              .
            </>
          ) : (
            <>Nobody has finished one yet.</>
          )}
          {activeTasks.length > 0 && (
            <>
              {' '}
              <span className="font-semibold text-white">
                {activeTasks.length}
              </span>{' '}
              {activeTasks.length === 1 ? 'member is' : 'members are'} out on
              task right now.
            </>
          )}
          {isCompetition && liveWheel && (
            <>
              {' '}
              The <span className="text-sanguine-bright">
                {liveWheel.name}
              </span>{' '}
              competition runs until {dayjs(liveWheel.endDate).format('MMMM D')}
              , paying{' '}
              <span className="text-white">{liveWheel.multiplier}x</span> drop
              points on task drops.
            </>
          )}
        </PageHeader>

        {totalTasks === 0 && activeTasks.length === 0 ? (
          <EmptyState>
            {rulesWheel === null
              ? 'The Slayer Master is out. Nothing interesting happens.'
              : "'Ello, and what are you after then? Nobody is on task."}
          </EmptyState>
        ) : (
          <>
            {totalTasks > 0 && <LeaderBand boards={leaderBoards} />}

            {/* The task log and the drops that finished the tasks share the row on large
                screens, divided by one red rule; they stack on mobile. */}
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-0 lg:divide-x-2 lg:divide-sanguine-red">
              {/* Task log: hiscores-style zebra rows, one per slayer */}
              <section className="lg:pr-8">
                <SectionHeading
                  title="Task log"
                  summary={
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">{slayers.length}</span>{' '}
                      slayers
                    </Text>
                  }
                />
                <Box mt="2">
                  <div
                    className={`${rowGridClass} border-b border-gray-700 py-2.5 text-osrs-orange`}
                  >
                    <span className="text-right text-sm">#</span>
                    {sortColumns.map(column => (
                      <SortableHeaderButton
                        key={column.field}
                        label={column.label}
                        align={column.align}
                        active={sortField === column.field}
                        direction={sortDirection}
                        onClick={() => onSortColumn(column.field)}
                        className={column.className}
                      />
                    ))}
                  </div>
                  {sortedSlayers.map((row, index) => (
                    <div
                      key={row.discordId}
                      onClick={() =>
                        navigateToUser(row.discordId, row.isMember)
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          navigateToUser(row.discordId, row.isMember);
                        }
                      }}
                      role={row.isMember ? 'link' : undefined}
                      tabIndex={row.isMember ? 0 : undefined}
                      className={`${rowGridClass} group py-2 ${zebraRowClass} ${
                        row.isMember ? 'cursor-pointer' : ''
                      }`}
                    >
                      <Text
                        as="div"
                        size="2"
                        className="text-right text-gray-600"
                      >
                        {index + 1}
                      </Text>
                      <Flex align="center" gap="3" className="min-w-0">
                        <img
                          src={fetchRankImage(row.role)}
                          alt={rankLabel(row.role)}
                          width={22}
                          height={22}
                          className="shrink-0 [image-rendering:pixelated]"
                        />
                        <Box className="min-w-0">
                          <Text
                            as="div"
                            className={`truncate leading-tight ${
                              row.isMember
                                ? 'text-sanguine-bright group-hover:text-white'
                                : 'text-gray-400'
                            }`}
                          >
                            {row.name}
                          </Text>
                          {/* The current task replaces the rank sublabel — on this page
                              what a member is hunting is the more useful fact. */}
                          <Text
                            as="div"
                            size="1"
                            className="truncate text-gray-500"
                          >
                            {row.activeTask
                              ? `On task: ${row.activeTask.bossDisplayName}`
                              : rankLabel(row.role)}
                          </Text>
                        </Box>
                      </Flex>
                      <Text
                        as="div"
                        className={`text-right ${
                          row.tasks === 0 ? 'text-gray-600' : 'text-white'
                        }`}
                      >
                        {row.tasks}
                      </Text>
                      {hasBonus && (
                        <Text
                          as="div"
                          className={`text-right ${WIDE_CELL_CLASS} ${
                            row.bonusPoints === 0
                              ? 'text-gray-600'
                              : 'text-white'
                          }`}
                        >
                          {row.bonusPoints.toLocaleString()}
                        </Text>
                      )}
                      <Text
                        as="div"
                        className={`text-right ${
                          row.clanPoints === 0
                            ? 'text-gray-600'
                            : 'text-osrs-gold'
                        }`}
                      >
                        {row.clanPoints.toLocaleString()}
                      </Text>
                      <Text
                        as="div"
                        size="2"
                        className={`text-right tabular-nums ${WIDE_CELL_CLASS} ${
                          row.loot === 0 ? 'text-gray-600' : 'text-osrs-gold'
                        }`}
                      >
                        {row.loot === 0 ? 0 : formatGp(row.loot)}
                      </Text>
                    </div>
                  ))}
                </Box>
              </section>

              {/* Completions: the drop that finished each task, newest first */}
              <section className="lg:pl-8">
                <SectionHeading
                  title="Completions"
                  summary={
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">{totalTasks}</span> tasks
                      finished
                    </Text>
                  }
                />
                {completions.length > 0 ? (
                  <Box mt="2">
                    {completionsPagination.pageItems.map(completion => {
                      const member = members[completion.discordId];
                      return (
                        <Flex
                          key={completion.id}
                          align="center"
                          gap="3"
                          className={`border-b border-gray-800 px-2 py-2 ${zebraStripeClass}`}
                        >
                          <Box className="flex h-7 w-7 shrink-0 items-center justify-center">
                            {completion.itemIcon && (
                              <img
                                src={completion.itemIcon}
                                alt=""
                                className="max-h-7 max-w-7 object-contain"
                              />
                            )}
                          </Box>
                          <Box className="min-w-0 flex-1">
                            <Text
                              as="div"
                              size="2"
                              weight="medium"
                              className="truncate text-white"
                            >
                              {completion.itemName}
                            </Text>
                            {/* Who finished it, and the task it finished */}
                            <Text
                              as="div"
                              size="2"
                              className="truncate text-gray-400"
                            >
                              {member ? (
                                <Link
                                  to={`/users/${completion.discordId}`}
                                  className={proseLinkClass}
                                >
                                  {member.nickname}
                                </Link>
                              ) : (
                                'Former member'
                              )}
                              {' · '}
                              {completion.bossDisplayName}
                            </Text>
                          </Box>
                          {/* Same right-hand stack as the drop log: date, value, points */}
                          <Flex
                            direction="column"
                            align="end"
                            className="shrink-0"
                          >
                            <Text
                              as="div"
                              size="2"
                              className="whitespace-nowrap text-gray-400"
                            >
                              {dayjs(completion.completedAt).format(
                                'MMM D, YYYY',
                              )}
                            </Text>
                            {completion.itemValue > 0 && (
                              <Text
                                as="div"
                                size="2"
                                className="whitespace-nowrap text-osrs-gold"
                              >
                                <CoinsIcon />{' '}
                                {completion.itemValue.toLocaleString()}
                              </Text>
                            )}
                            {completion.clanPoints > 0 && (
                              <Text
                                as="div"
                                size="2"
                                weight="medium"
                                className="whitespace-nowrap text-osrs-gold"
                              >
                                +{completion.clanPoints} clan
                              </Text>
                            )}
                            {completion.bonusPoints > 0 && (
                              <Text
                                as="div"
                                size="2"
                                weight="medium"
                                className="whitespace-nowrap text-white"
                              >
                                +{completion.bonusPoints} pts
                              </Text>
                            )}
                          </Flex>
                        </Flex>
                      );
                    })}
                    <Pagination
                      page={completionsPagination.page}
                      totalPages={completionsPagination.totalPages}
                      onPrev={completionsPagination.onPrev}
                      onNext={completionsPagination.onNext}
                    />
                  </Box>
                ) : (
                  <EmptyState>
                    No tasks finished yet. Nothing interesting happens.
                  </EmptyState>
                )}
              </section>
            </div>
          </>
        )}

        {/* The rules, read off the running instance so the numbers can never go stale */}
        {rulesWheel && (
          <section className="mt-10">
            <SectionHeading
              title="How it works"
              summary={
                <Text size="2" className="text-gray-500">
                  <span className="text-white">{rulesWheel.bossPoolSize}</span>{' '}
                  bosses in the pool
                </Text>
              }
            />
            <Text as="p" size="3" className="mt-3 leading-7 text-gray-300">
              Run <span className="text-white">/slayer task</span> in Discord
              and the Slayer Master spins for one of{' '}
              <span className="text-white">{rulesWheel.bossPoolSize}</span>{' '}
              bosses. Any drop from that boss that is worth{' '}
              <Link to="/drops" className={proseLinkClass}>
                drop points
              </Link>{' '}
              completes the task. Your Dink webhook posts it like normal and the
              bot does the rest, so there is nothing to submit.
            </Text>
            <Text as="p" size="3" className="mt-3 leading-7 text-gray-300">
              {rulesWheel.taskClanPoints > 0 ? (
                <>
                  Every completed task pays{' '}
                  <span className="text-osrs-gold">
                    {rulesWheel.taskClanPoints} clan points
                  </span>{' '}
                  on top of whatever the drop was already worth.
                </>
              ) : (
                <>
                  During a competition, task drops pay{' '}
                  <span className="text-white">
                    {rulesWheel.multiplier}x drop points
                  </span>{' '}
                  and the podium takes{' '}
                  <span className="text-osrs-gold">
                    {rulesWheel.prizePoints.first} /{' '}
                    {rulesWheel.prizePoints.second} /{' '}
                    {rulesWheel.prizePoints.third} clan points
                  </span>
                  .
                </>
              )}{' '}
              Hate the task? A free respin unlocks{' '}
              <span className="text-white">
                {rulesWheel.respinCooldownHours} hours
              </span>{' '}
              after it was handed out, or spend a skip to swap it instantly.
              Everyone starts with{' '}
              <span className="text-white">{rulesWheel.startingRerolls}</span>{' '}
              skips and earns {rulesWheel.rerollEarnRate} back per completed
              task.
            </Text>
            <Text as="p" size="3" className="mt-3 leading-7 text-gray-300">
              Pets count. Raid tasks accept any mode, normal or hard. Drops from
              a registered alt credit your main, same as regular points.
              {tasksAssigned > 0 && (
                <>
                  {' '}
                  So far the Slayer Master has handed out{' '}
                  <span className="text-white">
                    {tasksAssigned.toLocaleString()}
                  </span>{' '}
                  tasks, of which{' '}
                  <span className="text-white">
                    {tasksAbandoned.toLocaleString()}
                  </span>{' '}
                  were skipped or respun.
                </>
              )}
            </Text>
            <dl className="mt-4 border-t-2 border-t-sanguine-red">
              {[
                {
                  command: '/slayer task',
                  detail: 'get a task, or add skip:True to spend a skip',
                },
                {
                  command: '/slayer status',
                  detail: 'your task, your free respin timer, your skips',
                },
                { command: '/slayer log', detail: 'the current standings' },
              ].map(({ command, detail }) => (
                <div
                  key={command}
                  className={`grid grid-cols-[9.5rem_1fr] gap-x-3 border-b border-gray-800 px-2 py-2 ${zebraStripeClass}`}
                >
                  <dt className="whitespace-nowrap text-base text-white">
                    {command}
                  </dt>
                  <dd className="text-base text-gray-400">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </Flex>
    </Container>
  );
}
