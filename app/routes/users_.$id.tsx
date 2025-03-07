import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Grid, Text } from '@radix-ui/themes';
import { getUserWithNickname } from '~/services/sanguine-service.server';
import { getAuditDataForUserById } from '~/data/points-audit';
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `Members | ${data?.user?.nickname ?? 'Sanguine Member'}` },
    {
      name: 'description',
      content: `More information about ${data?.user?.nickname ?? 'a member'}`,
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const userPromise = getUserWithNickname(params.id ?? '');
  const userAuditDataPromise = getAuditDataForUserById(params.id ?? '');

  const [user, userAuditData] = await Promise.all([
    userPromise,
    userAuditDataPromise,
  ]);

  return json(
    {
      user: user,
      auditData: userAuditData,
    },
    200,
  );
}

export default function UserById() {
  const { user, auditData } = useLoaderData<typeof loader>();

  const summedPointsByYearMonth: { date: string; points: number }[] =
    Object.entries(
      auditData.reduce(
        (accumulator: { [yearMonth: string]: number }, message) => {
          const createdAtYearMonth = dayjs(message.createdAt).format(
            'YYYY-MMM',
          );
          accumulator[createdAtYearMonth] =
            (accumulator[createdAtYearMonth] || 0) + message.pointsGiven;
          return accumulator;
        },
        {},
      ),
    ).map(([date, points]) => ({ date, points }));

  return (
    <>
      <div
        style={{ width: '100vw', height: '70vh' }}
        className={'mt-5 flex flex-col content-center items-center gap-5'}
      >
        <Box>
          <Text size={'9'}>{user.nickname}</Text>
        </Box>
        <div className={'flex-row space-x-2'}>
          <Text
            size={'5'}
            className={'text-sanguine-red'}
            align={'center'}
          >{`${user.points} clan points`}</Text>
        </div>
        <Text>{`${user.nickname} Points Earned by Month`}</Text>
        {auditData.length ? (
          <ResponsiveContainer width="70%" height="85%">
            <BarChart width={2000} height={1000} data={summedPointsByYearMonth}>
              <Grid />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  background: 'black',
                }}
                wrapperStyle={{ background: 'transparent' }}
              />
              <Legend />
              <Bar dataKey="points" fill="#BB2C23" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Text>{'No points on record'}</Text>
        )}
      </div>
    </>
  );
}
