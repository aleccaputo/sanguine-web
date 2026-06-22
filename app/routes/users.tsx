import { defer, MetaFunction, SerializeFrom } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState } from 'react';
import {
  getUsersWithNicknames,
  ISanguineUserWithNickname,
} from '~/services/sanguine-service.server';

import {
  Box,
  Card,
  Flex,
  Text,
  Container,
  Grid,
  Heading,
  Select,
  IconButton,
} from '@radix-ui/themes';

import {
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@radix-ui/react-icons';
import { getClanFromWom } from '~/services/wom-api-service.server';
import { fetchRankImage, getRankSortIndex } from '~/utils/clan-ranks';
import { MembershipWithPlayer } from '@wise-old-man/utils';

type SortField = 'rank' | 'points' | 'name';
type SortDirection = 'asc' | 'desc';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Members' },
    { name: 'description', content: 'Members of sanguine' },
  ];
};

export async function loader() {
  const users = await getUsersWithNicknames();
  const sanguineWomMembers = await getClanFromWom(18435);
  const filteredUsers = users.filter(x => x.nickname);
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

  // Get rank text based on points
  const getRankText = (
    sanguineWomMembers: SerializeFrom<MembershipWithPlayer[]>,
    user: ISanguineUserWithNickname,
  ) => {
    return (
      sanguineWomMembers.find(
        x =>
          x.player.displayName.toLocaleLowerCase() ===
          user?.nickname?.toLocaleLowerCase(),
      )?.role ?? 'Guest'
    );
  };

  // Filter on search, then sort by the selected field and direction. Rank
  // ascending lists the highest rank first; guests fall to the bottom.
  const visibleUsers = users
    .filter((user): user is ISanguineUserWithNickname => user !== null)
    .filter(
      user =>
        user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false,
    )
    .map(user => ({ user, rank: getRankText(sanguineWomMembers, user) }))
    .sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      // Within equal primary keys, list the highest points first.
      const pointsTiebreak = b.user.points - a.user.points;
      switch (sortField) {
        case 'name':
          return (
            direction *
              (a.user.nickname ?? '').localeCompare(b.user.nickname ?? '') ||
            pointsTiebreak
          );
        case 'points':
          return direction * (a.user.points - b.user.points);
        case 'rank':
        default:
          return (
            direction *
              (getRankSortIndex(a.rank) - getRankSortIndex(b.rank)) ||
            pointsTiebreak
          );
      }
    });

  // Get rank icon based on points
  const getRankIcon = (rankName: string) => {
    return (
      <img
        src={fetchRankImage(rankName)}
        alt={rankName}
        width={26}
        height={26}
        className="inline-block"
      />
    );
  };

  return (
    <Container size="3" mt="3">
      <Flex direction="column" gap="5">
        <Box className="text-center">
          <Heading size="6" className="tracking-wide text-sanguine-red">
            Sanguine Members
          </Heading>
          <Box className="mx-auto mt-2 h-1 w-32 bg-sanguine-red"></Box>
        </Box>
        <Flex gap="3" align="center" justify="between" wrap="wrap">
          <Box className="relative w-full rounded border border-gray-700 px-2 py-1 focus-within:border-sanguine-red md:w-64">
            <Flex gap="2" align="center">
              <MagnifyingGlassIcon
                height="16"
                width="16"
                className="text-gray-400"
              />
              <input
                type="text"
                className="w-full bg-transparent font-runescape text-white outline-none"
                placeholder="Search members..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </Flex>
          </Box>
          <Flex gap="2" align="center">
            <Text size="2" className="text-gray-400">
              Sort by
            </Text>
            <Select.Root
              value={sortField}
              onValueChange={value => setSortField(value as SortField)}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="rank">Rank</Select.Item>
                <Select.Item value="points">Points</Select.Item>
                <Select.Item value="name">Name</Select.Item>
              </Select.Content>
            </Select.Root>
            <IconButton
              variant="soft"
              aria-label={`Sort ${
                sortDirection === 'asc' ? 'ascending' : 'descending'
              }`}
              onClick={() =>
                setSortDirection(direction =>
                  direction === 'asc' ? 'desc' : 'asc',
                )
              }
            >
              {sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </IconButton>
          </Flex>
        </Flex>
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
          {visibleUsers.map(({ user, rank }) => (
            <Card
              key={user.discordId}
              className="cursor-pointer border border-gray-800 bg-gray-900 transition-all duration-200 hover:border-sanguine-red"
              onClick={() => navigate(`/users/${user.discordId}`)}
            >
              <Flex p="3" gap="3" align="center" justify="between">
                <Box>
                  <Flex align="center" gap="2">
                    {getRankIcon(rank)}
                    <Text
                      as="div"
                      size="4"
                      className="font-bold tracking-wide text-sanguine-red"
                    >
                      {user.nickname}
                    </Text>
                  </Flex>
                  <Text as="div" size="2" className="mt-1 text-gray-400">
                    {user.points} points
                  </Text>
                </Box>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Flex>
    </Container>
  );
}
