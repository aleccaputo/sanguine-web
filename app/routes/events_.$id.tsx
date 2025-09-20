import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { getCompetitionById } from '~/services/wom-api-service.server';
import { useLoaderData } from '@remix-run/react';
import { Response } from '@remix-run/web-fetch';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAuditDataForDateRange } from '~/data/points-audit';
import dayjs from 'dayjs';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Text, Container, Heading, Box, Flex, Card } from '@radix-ui/themes';
import { getMetricType } from '~/utils/competition-images';
import { CompetitionHeader } from '~/components/CompetitionHeader';
import { ParticipantListItem } from '~/components/ParticipantListItem';

interface ParticipantInfo {
  nickname: string;
  displayName: string;
  startProgress: number;
  endProgress: number;
  gained: number;
}

interface ChartData {
  name: string;
  [key: string]: string | number;
}

interface EventStatus {
  status: string;
  color: string;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `${data?.compDetails.title ?? 'Sanguine Event'}` },
    {
      name: 'description',
      content: `More information about ${data?.compDetails?.title ?? 'the event.'}`,
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.id) {
    throw new Response('', { status: 404 });
  }
  const womComp = await getCompetitionById(parseInt(params.id, 10));
  const sanguineUsersPromise = getUsersWithNicknames();
  const pointAuditPromise = getAuditDataForDateRange(
    womComp.startsAt.toISOString(),
    womComp.endsAt.toISOString(),
  );

  const [sanguineUsers, pointAudit] = await Promise.all([
    sanguineUsersPromise,
    pointAuditPromise,
  ]);

  return json(
    {
      auditData: pointAudit,
      sanguineUsers: sanguineUsers,
      compDetails: womComp,
    },
    {
      headers: {
        'Cache-Control': 'max-age=300',
      },
      status: 200,
    },
  );
}
const CHART_COLORS = [
  '#BB2C23',
  '#DC7633',
  '#F39C12',
  '#F1C40F',
  '#58D68D',
  '#5DADE2',
  '#AF7AC5',
  '#EC7063',
];

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getEventStatus = (startsAt: string, endsAt: string): EventStatus => {
  const now = new Date();
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (now < start) return { status: 'Upcoming', color: 'text-blue-400' };
  if (now > end) return { status: 'Completed', color: 'text-gray-400' };
  return { status: 'Active', color: 'text-green-400' };
};

const EventById = () => {
  const data = useLoaderData<typeof loader>();
  const startDate = dayjs(data.compDetails.startsAt);
  const endDate = dayjs(data.compDetails.endsAt);
  const days = endDate.diff(startDate, 'days') + 1;

  // Build participant map with competition data
  const participantMap = new Map<string, ParticipantInfo>();
  data.compDetails.participations.forEach(participation => {
    const sanguineUser = data.sanguineUsers.find(
      user =>
        user.nickname?.toLowerCase().trim() ===
        participation.player.displayName.toLowerCase().trim(),
    );
    if (sanguineUser && sanguineUser.nickname) {
      participantMap.set(sanguineUser.discordId, {
        nickname: sanguineUser.nickname,
        displayName: participation.player.displayName,
        startProgress: participation.progress.start,
        endProgress: participation.progress.end,
        gained: participation.progress.gained,
      });
    }
  });

  const metric = getMetricType(data.compDetails.metric);

  // Process chart data - calculate cumulative points per day
  const chartData: ChartData[] = [];
  for (let i = 0; i < days; i++) {
    const currentDate = startDate.add(i, 'days');
    const dayData: ChartData = { name: currentDate.format('MMM DD') };

    participantMap.forEach((userInfo, discordId) => {
      const pointsForDay = data.auditData
        .filter(
          audit =>
            audit.destinationDiscordId === discordId &&
            dayjs(audit.createdAt).format('DD/MM/YYYY') ===
              currentDate.format('DD/MM/YYYY'),
        )
        .reduce((sum, audit) => sum + audit.pointsGiven, 0);

      dayData[`${userInfo.nickname}_points`] = pointsForDay;
    });

    chartData.push(dayData);
  }

  // Calculate cumulative totals
  const cumulativeData: ChartData[] = chartData.map((day, index) => {
    const cumulativeDay: ChartData = { name: day.name };

    participantMap.forEach(userInfo => {
      let cumulativePoints = 0;
      for (let i = 0; i <= index; i++) {
        cumulativePoints +=
          (chartData[i][`${userInfo.nickname}_points`] as number) || 0;
      }
      cumulativeDay[`${userInfo.nickname}_points`] = cumulativePoints;
    });

    return cumulativeDay;
  });

  const participantColors = Array.from(participantMap.values()).map(
    (_, index) => CHART_COLORS[index % CHART_COLORS.length],
  );

  const eventStatus = getEventStatus(
    data.compDetails.startsAt,
    data.compDetails.endsAt,
  );

  return (
    <Container size="4" mt="3">
      <Flex direction="column" gap="6">
        <CompetitionHeader
          competition={data.compDetails}
          eventStatus={eventStatus}
          participantCount={participantMap.size}
          formatDate={formatDate}
        />

        {/* Chart Section */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Heading size="5" className="mb-4 text-white">
              Daily Points Progress
            </Heading>

            {participantMap.size > 0 ? (
              <Box className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                      }}
                      formatter={(value, name) => {
                        const displayName =
                          typeof name === 'string'
                            ? name.replace('_points', '')
                            : name;
                        return [`${value} points`, displayName];
                      }}
                      itemSorter={item => -(item.value as number)}
                    />
                    {Array.from(participantMap.values()).map(
                      (userInfo, index) => (
                        <Line
                          key={`${userInfo.nickname}_points`}
                          type="monotone"
                          dataKey={`${userInfo.nickname}_points`}
                          stroke={participantColors[index]}
                          strokeWidth={2}
                          dot={{
                            fill: participantColors[index],
                            strokeWidth: 2,
                            r: 4,
                          }}
                          activeDot={{ r: 6 }}
                        />
                      ),
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box className="py-12 text-center">
                <Text size="3" className="text-gray-400">
                  No Sanguine participants found in this competition
                </Text>
              </Box>
            )}
          </Box>
        </Card>

        {/* Participants Summary */}
        {participantMap.size > 0 && (
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <Heading size="5" className="mb-4 text-white">
                Event Points Leaderboard
              </Heading>

              <Flex direction="column" gap="3">
                {Array.from(participantMap.values())
                  .map(userInfo => {
                    const sanguineUser = data.sanguineUsers.find(
                      user => user.nickname === userInfo.nickname,
                    );
                    const totalPoints = data.auditData
                      .filter(
                        audit =>
                          sanguineUser &&
                          audit.destinationDiscordId === sanguineUser.discordId,
                      )
                      .reduce((sum, audit) => sum + audit.pointsGiven, 0);

                    return {
                      ...userInfo,
                      totalPoints,
                      discordId: sanguineUser?.discordId || '',
                    };
                  })
                  .sort((a, b) => b.totalPoints - a.totalPoints)
                  .map((participant, index) => (
                    <ParticipantListItem
                      key={participant.nickname}
                      participant={participant}
                      rank={index + 1}
                      metric={metric}
                    />
                  ))}
              </Flex>
            </Box>
          </Card>
        )}
      </Flex>
    </Container>
  );
};

export default EventById;
