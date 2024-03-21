import { defer, json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Await, useLoaderData } from '@remix-run/react';
import { getUserById } from '~/data/user';
import { getNicknameById } from '~/data/nicknames';
import { Avatar, Box, Card, Flex, Spinner, Text } from '@radix-ui/themes';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getRecentItemsForUser } from '~/services/collection-log-service';
import { Suspense } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Members' },
    { name: 'description', content: 'Members of sanguine' },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const users = await getUsersWithNicknames();
  const filteredUsers = users.filter(x => x.nickname);
  const logData = Promise.all(
    users.map(x => getRecentItemsForUser(x.nickname ?? '')),
  );
  return defer(
    {
      users: filteredUsers,
      logData: logData,
    },
    200,
  );
}

export default function Index() {
  const { users, logData } = useLoaderData<typeof loader>();

  return (
    <div
      className={
        'spacing flex flex-row flex-wrap content-center items-center justify-center gap-5'
      }
    >
      {' '}
      {users
        .filter(x => x !== null)
        .sort((a, b) => (a.points < b.points ? 1 : -1))
        .map(user => (
          <div className={'basis-1/6'} key={user.discordId}>
            <Card
              style={{ maxWidth: 250, minHeight: 110 }}
              key={user.discordId}
              className={'gap-2'}
            >
              <Flex gap={'3'} align={'center'} justify={'center'}>
                <Avatar
                  fallback={user?.nickname?.[0] ?? 'S'}
                  radius={'full'}
                  size={'3'}
                />
                <Box>
                  <Text as={'div'} size={'2'} weight={'bold'}>
                    {user.nickname}
                  </Text>
                  <Text as="div" size="2" color="gray">
                    {user?.points ?? 0} points
                  </Text>
                  <Suspense fallback={<Spinner />}>
                    <Await resolve={logData}>
                      {logData => (
                        <Text as="div" size="2" color="gray">
                          {logData.find(x => x?.nickname === user.nickname)
                            ?.recentItems?.[0].name ?? 'Nothing'}{' '}
                          recently obtained!
                        </Text>
                      )}
                    </Await>
                  </Suspense>
                </Box>
              </Flex>
            </Card>
          </div>
        ))}
    </div>
  );
}
