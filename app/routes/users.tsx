import { defer, MetaFunction, SerializeFrom } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState } from 'react';
import dayjs from 'dayjs';
import {
  getUsersWithNicknames,
  ISanguineUserWithNickname,
} from '~/services/sanguine-service.server';

import { Box, Flex, Text, Container, Heading, Select } from '@radix-ui/themes';

import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import {
  getClanFromWom,
  type MembershipWithPlayer,
} from '~/services/wom-api-service.server';
import { getLegacyCompetitionPointsByDiscordId } from '~/data/points-audit';
import {
  fetchRankImage,
  getRankSortIndex,
  rankLabel,
} from '~/utils/clan-ranks';

type SortField = 'rank' | 'points' | 'clanPoints' | 'name' | 'joined';
type SortDirection = 'asc' | 'desc';

const STAFF_RANKS = ['owner', 'deputy_owner', 'administrator', 'moderator'];

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Members' },
    { name: 'description', content: 'Members of sanguine' },
  ];
};

export async function loader() {
  const [users, sanguineWomMembers, legacyCompetitionPoints] =
    await Promise.all([
      getUsersWithNicknames(),
      getClanFromWom(18435),
      getLegacyCompetitionPointsByDiscordId(),
    ]);
  // Pre-cutover COMPETITION awards count as clan points retroactively but were only ever added
  // to the drop bucket on the user record — credit them here so cards and sorting agree with
  // the profile page.
  const filteredUsers = users
    .filter(x => x.nickname)
    .map(user => ({
      ...user,
      clanPoints:
        user.clanPoints + (legacyCompetitionPoints[user.discordId] ?? 0),
    }));
  return defer(
    {
      users: filteredUsers,
      sanguineWomMembers,
    },
    {
      headers: {
        'Cache-Control': 'max-age=300',
      },
      status: 200,
    },
  );
}

export default function Index() {
  const { users, sanguineWomMembers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [rankFilter, setRankFilter] = useState('all');

  // Get rank text based on points
  const getRankText = (
    womMembers: SerializeFrom<MembershipWithPlayer[]>,
    user: ISanguineUserWithNickname,
  ) => {
    return (
      womMembers.find(
        x =>
          x.player.displayName.toLocaleLowerCase() ===
          user?.nickname?.toLocaleLowerCase(),
      )?.role ?? 'Guest'
    );
  };

  const roster = users
    .filter((user): user is ISanguineUserWithNickname => user !== null)
    .map(user => ({ user, rank: getRankText(sanguineWomMembers, user) }));

  const totalDropPoints = roster.reduce((sum, x) => sum + x.user.points, 0);
  const totalClanPoints = roster.reduce((sum, x) => sum + x.user.clanPoints, 0);

  const leaderBoards = [
    {
      title: 'Top clan point earners',
      field: 'clanPoints' as const,
      valueClass: 'text-osrs-gold',
      entries: [...roster]
        .sort((a, b) => b.user.clanPoints - a.user.clanPoints)
        .slice(0, 3),
    },
    {
      title: 'Top drop point earners',
      field: 'points' as const,
      valueClass: 'text-white',
      entries: [...roster]
        .sort((a, b) => b.user.points - a.user.points)
        .slice(0, 3),
    },
  ];

  // Rank filter options: All and Staff first, then every non-staff rank present on
  // the roster in hierarchy order.
  const nonStaffRanks = [
    ...new Set(roster.map(x => x.rank.toLocaleLowerCase())),
  ]
    .filter(rank => !STAFF_RANKS.includes(rank))
    .sort((a, b) => getRankSortIndex(a) - getRankSortIndex(b));
  const rankOptions = [
    {
      key: 'all',
      label: 'All ranks',
      test: () => true,
    },
    {
      key: 'staff',
      label: 'Staff',
      test: (rank: string) => STAFF_RANKS.includes(rank.toLocaleLowerCase()),
    },
    ...nonStaffRanks.map(rank => ({
      key: rank,
      label: rankLabel(rank),
      test: (memberRank: string) => memberRank.toLocaleLowerCase() === rank,
    })),
  ];
  const activeRankOption =
    rankOptions.find(c => c.key === rankFilter) ?? rankOptions[0];

  // Filter on search and rank chip, then sort by the selected column. Rank ascending
  // lists the hierarchy top-first; guests fall to the bottom on points sorts.
  const visibleUsers = roster
    .filter(
      ({ user }) =>
        user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false,
    )
    .filter(({ rank }) => activeRankOption.test(rank))
    .sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      // Within equal primary keys, list the highest points first.
      const pointsTiebreak = b.user.points - a.user.points;
      // Points sorts keep guests at the bottom regardless of direction, sorted
      // amongst themselves by the same field.
      const guestOrder =
        Number(a.rank.toLocaleLowerCase() === 'guest') -
        Number(b.rank.toLocaleLowerCase() === 'guest');
      switch (sortField) {
        case 'name':
          return (
            direction *
              (a.user.nickname ?? '').localeCompare(b.user.nickname ?? '') ||
            pointsTiebreak
          );
        case 'joined':
          return (
            direction * a.user.joined.localeCompare(b.user.joined) ||
            pointsTiebreak
          );
        case 'points':
          return guestOrder || direction * (a.user.points - b.user.points);
        case 'clanPoints':
          return (
            guestOrder ||
            direction * (a.user.clanPoints - b.user.clanPoints) ||
            pointsTiebreak
          );
        case 'rank':
        default:
          return (
            direction * (getRankSortIndex(a.rank) - getRankSortIndex(b.rank)) ||
            pointsTiebreak
          );
      }
    });

  const onSortColumn = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(direction => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    // Rank/name/joined read top-down naturally ascending; points columns lead with the
    // highest earners.
    setSortDirection(
      field === 'points' || field === 'clanPoints' ? 'desc' : 'asc',
    );
  };

  const formatJoined = (joined: string) => {
    const date = dayjs(joined);
    return date.isValid() ? date.format('MMM YYYY') : '—';
  };

  // Right-aligned columns put the sort arrow before the label so the label's right
  // edge stays flush with the numbers beneath it.
  const sortColumns: {
    field: SortField;
    label: string;
    align: 'left' | 'right';
    className: string;
  }[] = [
    { field: 'rank', label: '#', align: 'right', className: 'justify-end' },
    { field: 'name', label: 'Member', align: 'left', className: '' },
    {
      field: 'joined',
      label: 'Joined',
      align: 'left',
      className: 'hidden md:flex',
    },
    {
      field: 'points',
      label: 'Drop pts',
      align: 'right',
      className: 'justify-end',
    },
    {
      field: 'clanPoints',
      label: 'Clan pts',
      align: 'right',
      className: 'justify-end',
    },
  ];

  const rowGridClass =
    'grid grid-cols-[24px_1fr_76px_76px] items-center gap-2 px-2 md:grid-cols-[40px_1fr_110px_120px_120px] md:gap-3 md:px-3';

  return (
    <Container size="3" mt="3">
      <Flex direction="column">
        {/* Page header */}
        <Box mb="6">
          <Flex align="center" gap="3">
            <img src="/sanguine_icon_small.png" alt="" width={44} height={44} />
            <Heading size="8" className="font-normal text-sanguine-bright">
              Members
            </Heading>
          </Flex>
          <Text as="p" size="2" className="mt-2 text-gray-400">
            <span className="font-semibold text-sanguine-bright">
              {roster.length}
            </span>{' '}
            members holding{' '}
            <span className="font-semibold text-white">
              {totalDropPoints.toLocaleString()}
            </span>{' '}
            drop points and{' '}
            <span className="font-semibold text-osrs-gold">
              {totalClanPoints.toLocaleString()}
            </span>{' '}
            clan points
          </Text>
        </Box>

        {/* Leader band: flat, typographic, no boxes */}
        <Box
          mb="6"
          className="border-b border-t-2 border-gray-800 border-t-sanguine-red"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {leaderBoards.map((board, boardIndex) => (
              <div
                key={board.field}
                className={
                  boardIndex > 0
                    ? 'border-t border-gray-800 pb-2 sm:border-l sm:border-t-0 sm:pl-5'
                    : 'pb-2 sm:pr-5'
                }
              >
                <Text as="p" size="1" className="pt-2 text-gray-500">
                  {board.title}
                </Text>
                {board.entries.map(({ user, rank }, index) => (
                  <button
                    key={user.discordId}
                    onClick={() => navigate(`/users/${user.discordId}`)}
                    className="group flex w-full min-w-0 items-center gap-3 py-1.5 text-left"
                  >
                    <span
                      className={`w-5 shrink-0 text-right leading-none ${
                        index === 0
                          ? 'text-xl text-osrs-gold'
                          : 'text-base text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <img
                      src={fetchRankImage(rank)}
                      alt={rankLabel(rank)}
                      width={22}
                      height={22}
                      className="shrink-0 [image-rendering:pixelated]"
                    />
                    <Text
                      as="div"
                      className={`min-w-0 flex-1 truncate leading-tight text-sanguine-bright group-hover:text-white ${
                        index === 0 ? 'text-xl' : 'text-base'
                      }`}
                    >
                      {user.nickname}
                    </Text>
                    <Text
                      as="div"
                      className={`text-right ${board.valueClass} ${
                        index === 0 ? 'text-xl' : 'text-base'
                      }`}
                    >
                      {user[board.field].toLocaleString()}
                    </Text>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Box>

        {/* Sticky toolbar: search + rank filter chips */}
        <Box className="sticky top-[73px] z-10 -mx-4 border-b border-gray-800 bg-[#111113] px-4 py-3 sm:-mx-6 sm:px-6">
          <Flex gap="2" align="center" wrap="wrap">
            <Flex
              gap="2"
              align="center"
              className="w-60 rounded-sm border border-gray-800 bg-gray-900 px-3 py-1.5 focus-within:border-sanguine-red"
            >
              <MagnifyingGlassIcon
                height="14"
                width="14"
                className="shrink-0 text-gray-500"
              />
              <input
                type="text"
                className="w-full bg-transparent text-white outline-none placeholder:text-gray-500"
                placeholder="Search members..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </Flex>
            <Select.Root value={rankFilter} onValueChange={setRankFilter}>
              <Select.Trigger color="gray" />
              <Select.Content position="popper">
                {rankOptions.map(option => (
                  <Select.Item key={option.key} value={option.key}>
                    {`${option.label} (${
                      roster.filter(x => option.test(x.rank)).length
                    })`}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Box>

        {/* Roster: hiscores-style zebra table */}
        <Box mt="2">
          <div
            className={`${rowGridClass} border-b border-gray-700 py-2.5 text-osrs-orange`}
          >
            {sortColumns.map(column => {
              const arrow = sortField === column.field && (
                <span className="text-[9px] text-sanguine-bright">
                  {sortDirection === 'asc' ? '▲' : '▼'}
                </span>
              );
              return (
                <button
                  key={column.field}
                  onClick={() => onSortColumn(column.field)}
                  className={`flex items-center gap-1 text-left text-sm hover:text-osrs-gold ${
                    sortField === column.field ? 'text-osrs-gold' : ''
                  } ${column.className}`}
                >
                  {column.align === 'right' && arrow}
                  {column.label}
                  {column.align === 'left' && arrow}
                </button>
              );
            })}
          </div>

          {visibleUsers.length === 0 ? (
            <Text as="p" align="center" className="py-12 text-gray-600">
              Nothing interesting happens.
            </Text>
          ) : (
            visibleUsers.map(({ user, rank }, index) => (
              <div
                key={user.discordId}
                onClick={() => navigate(`/users/${user.discordId}`)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    navigate(`/users/${user.discordId}`);
                  }
                }}
                role="link"
                tabIndex={0}
                className={`${rowGridClass} group cursor-pointer py-2 even:bg-sanguine-red/[0.05] hover:bg-sanguine-red/[0.09]`}
              >
                <Text as="div" size="2" className="text-right text-gray-600">
                  {index + 1}
                </Text>
                <Flex align="center" gap="3" className="min-w-0">
                  <img
                    src={fetchRankImage(rank)}
                    alt={rankLabel(rank)}
                    width={22}
                    height={22}
                    className="shrink-0 [image-rendering:pixelated]"
                  />
                  <Box className="min-w-0">
                    <Text
                      as="div"
                      className="truncate leading-tight text-sanguine-bright group-hover:text-white"
                    >
                      {user.nickname}
                    </Text>
                    <Text as="div" size="1" className="text-gray-500">
                      {rankLabel(rank)}
                    </Text>
                  </Box>
                </Flex>
                <Text
                  as="div"
                  size="2"
                  className="hidden tabular-nums text-gray-400 md:block"
                >
                  {formatJoined(user.joined)}
                </Text>
                <Text
                  as="div"
                  className={`text-right ${
                    user.points === 0 ? 'text-gray-600' : 'text-white'
                  }`}
                >
                  {user.points.toLocaleString()}
                </Text>
                <Text
                  as="div"
                  className={`text-right ${
                    user.clanPoints === 0 ? 'text-gray-600' : 'text-osrs-gold'
                  }`}
                >
                  {user.clanPoints.toLocaleString()}
                </Text>
              </div>
            ))
          )}

          <Text
            as="p"
            size="1"
            className="border-t border-gray-800 py-3 text-gray-600"
          >
            {visibleUsers.length === roster.length
              ? `${roster.length} members`
              : `${visibleUsers.length} of ${roster.length} members`}
          </Text>
        </Box>
      </Flex>
    </Container>
  );
}
