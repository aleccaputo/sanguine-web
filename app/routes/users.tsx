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
  IconButton,
} from '@radix-ui/themes';

import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons';
import { getClanFromWom } from '~/services/wom-api-service.server';
import { fetchRankImage } from '~/utils/clan-ranks';
import { MembershipWithPlayer } from '@wise-old-man/utils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Members' },
    { name: 'description', content: 'Members of sanguine' },
  ];
};

export async function loader() {
  const users = await getUsersWithNicknames();
  const sanguineWomMembers = await getClanFromWom(4255);
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
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>(
    {},
  );

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

  // Filter users based on search term. Put guests at bottom
  const filteredUsers = users
    .filter(x => x !== null)
    .filter(
      user =>
        user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false,
    )
    .sort((a, b) => {
      const aIsGuest = getRankText(sanguineWomMembers, a) === 'Guest';
      const bIsGuest = getRankText(sanguineWomMembers, b) === 'Guest';

      return (
        Number(aIsGuest) - Number(bIsGuest) || (a.points < b.points ? 1 : -1)
      );
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

  const toggleExpandUser = (userId: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
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
        </Flex>
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
          {filteredUsers.map(user => (
            <Card
              key={user.discordId}
              className="border border-gray-800 bg-gray-900 transition-all duration-200 hover:border-sanguine-red"
            >
              <Flex
                p="3"
                gap="3"
                align="center"
                justify="between"
                className="cursor-pointer"
                onClick={() => toggleExpandUser(user.discordId)}
              >
                <Box>
                  <Flex align="center" gap="2">
                    {getRankIcon(getRankText(sanguineWomMembers, user))}
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
                <IconButton
                  variant="ghost"
                  color="gray"
                  onClick={e => {
                    e.stopPropagation();
                    toggleExpandUser(user.discordId);
                  }}
                >
                  {expandedUsers[user.discordId] ? (
                    <ChevronUpIcon width="16" height="16" />
                  ) : (
                    <ChevronDownIcon width="16" height="16" />
                  )}
                </IconButton>
              </Flex>
              <Box
                className={`
                  overflow-hidden bg-black transition-all duration-300
                  ${expandedUsers[user.discordId] ? 'max-h-64 p-3' : 'max-h-0 p-0'}
                `}
              >
                <Box className="border-l-2 border-sanguine-red pl-3">
                  <Text as="div" size="2" mb="2" className="text-white">
                    Member Stats:
                  </Text>

                  <Flex direction="column" gap="1">
                    <Flex justify="between">
                      <Text size="1" className="text-gray-400">
                        Rank:
                      </Text>
                      <Text size="1" className="text-sanguine-red">
                        {getRankText(sanguineWomMembers, user)}
                      </Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" className="text-gray-400">
                        Joined:
                      </Text>
                      <Text size="1" className="text-white">
                        {new Date(user.joined).toLocaleDateString()}
                      </Text>
                    </Flex>
                  </Flex>

                  <Flex mt="3" justify="end">
                    <Box
                      className="cursor-pointer bg-sanguine-red px-3 py-1 text-white transition-colors hover:bg-red-700"
                      onClick={() => navigate(`/users/${user.discordId}`)}
                    >
                      <Text size="1">View Profile</Text>
                    </Box>
                  </Flex>
                </Box>
              </Box>
            </Card>
          ))}
        </Grid>
      </Flex>
    </Container>
  );
}
