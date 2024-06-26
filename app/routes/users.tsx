import { defer, MetaFunction } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Members' },
    { name: 'description', content: 'Members of sanguine' },
  ];
};

export async function loader() {
  const users = await getUsersWithNicknames();
  const filteredUsers = users.filter(x => x.nickname);
  return defer(
    {
      users: filteredUsers,
    },
    200,
  );
}

export default function Index() {
  const { users } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div
      className={
        'spacing mt-5 flex flex-row flex-wrap content-center items-center justify-center gap-5'
      }
    >
      {users
        .filter(x => x !== null)
        .sort((a, b) => (a.points < b.points ? 1 : -1))
        .map(user => (
          <div className={'flex-'} key={user.discordId}>
            <Card
              style={{ maxWidth: 300, minHeight: 150 }}
              key={user.discordId}
              className={'cursor-pointer gap-2 hover:bg-sanguine-red'}
              onClick={() => navigate(`/users/${user.discordId}`)}
            >
              <Flex gap={'3'} align={'center'} justify={'center'}>
                <Avatar
                  color={'crimson'}
                  fallback={user?.nickname?.[0] ?? 'S'}
                  radius={'full'}
                  size={'3'}
                />
                <Box>
                  <Text as={'div'} size={'2'} className={'text-sanguine-red'}>
                    {user.nickname}
                  </Text>
                  <Text as="div" size="2" color="gray">
                    {user?.points ?? 0} points
                  </Text>
                </Box>
              </Flex>
            </Card>
          </div>
        ))}
    </div>
  );
}
