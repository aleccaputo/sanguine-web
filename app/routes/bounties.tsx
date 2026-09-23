import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import dayjs from 'dayjs';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
import { getBountyBoard, IBounty } from '~/services/bounty-service.server';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getClanFromWom } from '~/services/wom-api-service.server';
import { fetchRankImage, rankLabel } from '~/utils/clan-ranks';
import { PageHeader } from '~/components/PageHeader';
import { LeaderBand, ILeaderBoard } from '~/components/LeaderBand';
import { SectionHeading } from '~/components/SectionHeading';
import { CoinsIcon } from '~/components/CoinsIcon';
import { EmptyState } from '~/components/EmptyState';
import { Pagination } from '~/components/Pagination';
import {
  proseLinkClass,
  zebraRowClass,
  zebraStripeClass,
} from '~/utils/styles';
import {
  BOUNTY_ICON,
  BOUNTY_STATUS,
  describeBountyState,
  ordinal,
  slotsRemaining,
} from '~/utils/bounty';
import { usePagination } from '~/utils/use-pagination';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Bounties' },
    {
      name: 'description',
      content:
        'Clan bounties: which bosses were posted, who claimed them, and the clan points paid.',
    },
  ];
};

export async function loader() {
  const [bounties, users, womMembers] = await Promise.all([
    getBountyBoard(),
    getUsersWithNicknames(),
    getClanFromWom(),
  ]);

  // Claims key off discordId; names and rank icons come from the roster, the same bridge
  // every other page uses.
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
    { bounties, members },
    { headers: { 'Cache-Control': 'max-age=120' } },
  );
}

const claimCount = (bounty: IBounty) => bounty.claims.length;

/** The card's state line, with the date it refers to formatted for the page. */
const stateLine = (bounty: IBounty): string => {
  const { label, dateKey } = describeBountyState({
    status: bounty.status,
    maxWinners: bounty.maxWinners,
    claimCount: claimCount(bounty),
    expiresAt: bounty.expiresAt,
    closedAt: bounty.closedAt,
  });
  const date = dateKey ? bounty[dateKey] : null;
  return date ? `${label} ${dayjs(date).format('MMM D, YYYY')}` : label;
};

export default function Bounties() {
  const { bounties, members } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const open = bounties.filter(bounty => bounty.status === BOUNTY_STATUS.OPEN);
  const closed = bounties.filter(
    bounty => bounty.status !== BOUNTY_STATUS.OPEN,
  );
  const claims = bounties.flatMap(bounty =>
    bounty.claims.map(claim => ({ ...claim, bounty })),
  );

  // One row per member who has ever claimed a bounty.
  const hunters = [
    ...claims
      .reduce((rows, claim) => {
        const row = rows.get(claim.discordId) ?? {
          discordId: claim.discordId,
          wins: 0,
          firsts: 0,
          clanPoints: 0,
          loot: 0,
        };
        return rows.set(claim.discordId, {
          ...row,
          wins: row.wins + 1,
          firsts: row.firsts + (claim.placement === 1 ? 1 : 0),
          clanPoints: row.clanPoints + claim.clanPoints,
          loot: row.loot + claim.itemValue,
        });
      }, new Map<string, { discordId: string; wins: number; firsts: number; clanPoints: number; loot: number }>())
      .values(),
  ].map(row => {
    const member = members[row.discordId];
    return {
      ...row,
      // Members who left keep their record; the roster just can't name them.
      name: member?.nickname ?? 'Former member',
      role: member?.role ?? 'Guest',
      isMember: member !== undefined,
    };
  });

  const totalClanPoints = claims.reduce((sum, c) => sum + c.clanPoints, 0);
  const settled = closed.filter(
    bounty => bounty.status !== BOUNTY_STATUS.CANCELLED,
  );
  const unclaimed = settled.filter(bounty => claimCount(bounty) === 0).length;

  const navigateToUser = (discordId: string, isMember: boolean) => {
    if (!isMember) return;
    navigate(`/users/${discordId}`);
  };

  const historyPagination = usePagination(closed, 10);

  const leaderBoards: ILeaderBoard[] = [
    {
      key: 'wins',
      title: 'Most bounties claimed',
      valueClassName: 'text-white',
      entries: [...hunters]
        .sort((a, b) => b.wins - a.wins || b.firsts - a.firsts)
        .slice(0, 3)
        .map(row => ({
          key: row.discordId,
          iconSrc: fetchRankImage(row.role),
          iconAlt: rankLabel(row.role),
          label: row.name,
          value: row.wins.toLocaleString(),
          onClick: row.isMember
            ? () => navigateToUser(row.discordId, row.isMember)
            : undefined,
        })),
    },
    {
      key: 'clanPoints',
      title: 'Most clan points from bounties',
      valueClassName: 'text-osrs-gold',
      entries: [...hunters]
        .sort((a, b) => b.clanPoints - a.clanPoints || b.wins - a.wins)
        .slice(0, 3)
        .map(row => ({
          key: row.discordId,
          iconSrc: fetchRankImage(row.role),
          iconAlt: rankLabel(row.role),
          label: row.name,
          value: row.clanPoints.toLocaleString(),
          onClick: row.isMember
            ? () => navigateToUser(row.discordId, row.isMember)
            : undefined,
        })),
    },
  ];

  const memberName = (discordId: string) => {
    const member = members[discordId];
    return member ? (
      <Link to={`/users/${discordId}`} className={proseLinkClass}>
        {member.nickname}
      </Link>
    ) : (
      <span className="text-gray-400">Former member</span>
    );
  };

  return (
    <Container size="4" mt="3" pb="6">
      <Flex direction="column">
        <PageHeader title="Bounties" iconSrc={BOUNTY_ICON}>
          First point-worthy drop from the bounty boss wins clan points.{' '}
          {bounties.length > 0 ? (
            <>
              <span className="font-semibold text-white">
                {bounties.length}
              </span>{' '}
              posted
              {claims.length > 0 && (
                <>
                  ,{' '}
                  <span className="font-semibold text-white">
                    {claims.length}
                  </span>{' '}
                  {claims.length === 1 ? 'claim' : 'claims'} by{' '}
                  <span className="font-semibold text-sanguine-bright">
                    {hunters.length}
                  </span>{' '}
                  {hunters.length === 1 ? 'member' : 'members'} worth{' '}
                  <span className="font-semibold text-osrs-gold">
                    {totalClanPoints.toLocaleString()}
                  </span>{' '}
                  clan points
                </>
              )}
              {unclaimed > 0 && (
                <>
                  ,{' '}
                  <span className="font-semibold text-white">{unclaimed}</span>{' '}
                  unclaimed
                </>
              )}
              .
            </>
          ) : (
            <>None posted yet.</>
          )}
        </PageHeader>

        {bounties.length === 0 ? (
          <EmptyState>No bounties yet.</EmptyState>
        ) : (
          <>
            {/* Open bounties first: what people should be killing right now */}
            <section className="mb-10">
              <SectionHeading
                title="Open now"
                summary={
                  <Text size="2" className="text-gray-500">
                    <span className="text-white">{open.length}</span>{' '}
                    {open.length === 1 ? 'bounty' : 'bounties'} open
                  </Text>
                }
              />
              {open.length > 0 ? (
                <Box mt="2">
                  {open.map(bounty => {
                    const left = slotsRemaining({
                      status: bounty.status,
                      maxWinners: bounty.maxWinners,
                      claimCount: claimCount(bounty),
                    });
                    return (
                      <Flex
                        key={bounty.id}
                        align="center"
                        gap="3"
                        className={`border-b border-gray-800 px-2 py-3 ${zebraStripeClass}`}
                      >
                        <Box className="flex h-9 w-9 shrink-0 items-center justify-center">
                          <img
                            src={bounty.bossImageUrl}
                            alt=""
                            className="max-h-9 max-w-9 object-contain"
                          />
                        </Box>
                        <Box className="min-w-0 flex-1">
                          <Text
                            as="div"
                            size="3"
                            weight="medium"
                            className="truncate text-white"
                          >
                            {bounty.bossDisplayName}
                          </Text>
                          <Text as="div" size="2" className="text-gray-400">
                            {bounty.maxWinners === 1
                              ? 'First drop wins'
                              : `First ${bounty.maxWinners} drops win`}{' '}
                            <span className="text-osrs-gold">
                              {bounty.rewardClanPoints} clan points
                            </span>
                            {bounty.maxWinners > 1 && ' each'}
                            {bounty.onlyItems.length > 0 && (
                              <>
                                {' · only '}
                                <span className="text-white">
                                  {bounty.onlyItems.join(' or ')}
                                </span>{' '}
                                counts
                              </>
                            )}
                            {' · '}
                            {stateLine(bounty)}
                            {bounty.maxWinners > 1 && (
                              <>
                                {' · '}
                                <span className="text-white">
                                  {left}
                                </span> of {bounty.maxWinners} left
                              </>
                            )}
                          </Text>
                          {bounty.claims.length > 0 && (
                            <Text as="div" size="2" className="text-gray-400">
                              Claimed by{' '}
                              {bounty.claims.map((claim, index) => (
                                <span key={claim.discordId}>
                                  {index > 0 && ', '}
                                  {memberName(claim.discordId)}
                                </span>
                              ))}
                            </Text>
                          )}
                        </Box>
                        <Text
                          as="div"
                          size="2"
                          className="shrink-0 whitespace-nowrap text-gray-400"
                        >
                          posted {dayjs(bounty.postedAt).format('MMM D')}
                        </Text>
                      </Flex>
                    );
                  })}
                </Box>
              ) : (
                <EmptyState>None open.</EmptyState>
              )}
            </section>

            {claims.length > 0 && <LeaderBand boards={leaderBoards} />}

            {/* History: every closed bounty, with who claimed it and what they got */}
            <section>
              <SectionHeading
                title="Past bounties"
                summary={
                  <Text size="2" className="text-gray-500">
                    <span className="text-white">{closed.length}</span>{' '}
                    {closed.length === 1 ? 'bounty' : 'bounties'} closed
                  </Text>
                }
              />
              {closed.length > 0 ? (
                <Box mt="2" className="overflow-x-auto">
                  <Table.Root size="2">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell className="text-osrs-orange">
                          Boss
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell className="text-osrs-orange">
                          Claimed by
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                          Outcome
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell
                          className="whitespace-nowrap text-osrs-orange"
                          align="right"
                        >
                          Clan pts
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {historyPagination.pageItems.map(bounty => {
                        const paid = bounty.claims.reduce(
                          (sum, claim) => sum + claim.clanPoints,
                          0,
                        );
                        return (
                          <Table.Row key={bounty.id} className={zebraRowClass}>
                            <Table.Cell className="text-white">
                              <Flex align="center" gap="2">
                                <Box className="flex h-7 w-7 shrink-0 items-center justify-center">
                                  <img
                                    src={bounty.bossImageUrl}
                                    alt=""
                                    className="max-h-7 max-w-7 object-contain"
                                  />
                                </Box>
                                <Flex direction="column">
                                  <Text size="2" weight="medium">
                                    {bounty.bossDisplayName}
                                  </Text>
                                  <Text size="1" className="text-gray-500">
                                    {dayjs(bounty.postedAt).format(
                                      'MMM D, YYYY',
                                    )}
                                    {bounty.maxWinners > 1 &&
                                      ` · first ${bounty.maxWinners}`}
                                  </Text>
                                </Flex>
                              </Flex>
                            </Table.Cell>
                            <Table.Cell>
                              {bounty.claims.length > 0 ? (
                                <Flex direction="column" gap="1">
                                  {bounty.claims.map(claim => (
                                    <Flex
                                      key={claim.discordId}
                                      align="center"
                                      gap="2"
                                    >
                                      <Box className="flex h-6 w-6 shrink-0 items-center justify-center">
                                        {claim.itemIcon && (
                                          <img
                                            src={claim.itemIcon}
                                            alt=""
                                            className="max-h-6 max-w-6 object-contain"
                                          />
                                        )}
                                      </Box>
                                      <Text size="2" className="text-gray-400">
                                        {bounty.maxWinners > 1 && (
                                          <span className="mr-1 text-gray-500">
                                            {ordinal(claim.placement)}
                                          </span>
                                        )}
                                        {memberName(claim.discordId)}
                                        {' · '}
                                        <span className="text-white">
                                          {claim.itemName}
                                        </span>
                                        {claim.itemValue > 0 && (
                                          <span className="ml-1 whitespace-nowrap text-osrs-gold">
                                            <CoinsIcon />{' '}
                                            {claim.itemValue.toLocaleString()}
                                          </span>
                                        )}
                                      </Text>
                                    </Flex>
                                  ))}
                                </Flex>
                              ) : (
                                <Text size="2" className="text-gray-600">
                                  Nobody
                                </Text>
                              )}
                            </Table.Cell>
                            <Table.Cell className="hidden whitespace-nowrap text-gray-400 md:table-cell">
                              {stateLine(bounty)}
                            </Table.Cell>
                            <Table.Cell align="right">
                              <Text
                                as="div"
                                size="2"
                                className={`whitespace-nowrap font-medium ${
                                  paid === 0
                                    ? 'text-gray-600'
                                    : 'text-osrs-gold'
                                }`}
                              >
                                {paid === 0 ? '—' : `+${paid}`}
                              </Text>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Root>
                  <Pagination
                    page={historyPagination.page}
                    totalPages={historyPagination.totalPages}
                    onPrev={historyPagination.onPrev}
                    onNext={historyPagination.onNext}
                  />
                </Box>
              ) : (
                <EmptyState>None closed yet.</EmptyState>
              )}
            </section>
          </>
        )}

        <section className="mt-10">
          <SectionHeading title="How it works" />
          <Text as="p" size="3" className="mt-3 leading-7 text-gray-300">
            Bounties are posted in Discord. Drops count automatically through
            Dink; if Dink is down, post a screenshot and tell a mod. Separate
            from your{' '}
            <Link to="/slayer" className={proseLinkClass}>
              slayer task
            </Link>
            , so one drop can count for both. One claim per person.
          </Text>
        </section>
      </Flex>
    </Container>
  );
}
