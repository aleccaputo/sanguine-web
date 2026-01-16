import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { getCompetitionById } from '~/services/wom-api-service.server';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { Response } from '@remix-run/web-fetch';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAuditDataForDateRange } from '~/data/points-audit';
import dayjs from 'dayjs';
import { useState } from 'react';
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
import { ClickableUserName } from '~/components/ClickableUserName';

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

  const filteredAuditData = pointAudit.filter(x => x.type !== 'ONE_TIME');

  return json(
    {
      auditData: filteredAuditData,
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
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'points' | 'metric'>('points');
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
              currentDate.format('DD/MM/YYYY') &&
            (metric === 'EHB' || metric === 'EHP' // if EHP or EHB, just count all points, otherwise filter to boss
              ? true
              : audit.bossName?.toLowerCase().replaceAll(' ', '_') ===
                data.compDetails.metric),
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
          navigationSlot={
            <Flex gap="2" wrap="wrap" align="center" className="justify-start sm:justify-end">
              <button
                onClick={() =>
                  document
                    .getElementById('chart')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="rounded bg-sanguine-red px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9a231c] sm:px-4 sm:py-2 sm:text-base"
              >
                Chart
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById('spoons')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="rounded bg-sanguine-red px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9a231c] sm:px-4 sm:py-2 sm:text-base"
              >
                Spoons
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById('leaderboard')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="rounded bg-sanguine-red px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9a231c] sm:px-4 sm:py-2 sm:text-base"
              >
                Leaderboard
              </button>
              <a
                href={`https://wiseoldman.net/competitions/${data.compDetails.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline"
              >
                <button className="rounded bg-sanguine-red px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#9a231c] sm:px-4 sm:py-2 sm:text-base">
                  View on WoM
                </button>
              </a>
            </Flex>
          }
        />

        {/* Chart Section */}
        <Card id="chart" className="scroll-mt-6 border border-gray-800 bg-gray-900">
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

        {/* Spoons Statistics */}
        {participantMap.size > 0 && (
          <Card id="spoons" className="scroll-mt-6 border border-gray-800 bg-gray-900">
            <Box p="4">
              <Heading size="4" className="mb-3 text-white">
                Spoon Statistics
              </Heading>

              <Flex gap="3" className="grid grid-cols-1 md:grid-cols-2">
                {/* Biggest Spoons - High Points/Metric */}
                <Box className="p-3">
                  <Heading size="3" className="mb-2 text-green-400">
                    Biggest Spoons
                  </Heading>
                  <Text size="1" className="mb-2 text-gray-400">
                    Most points per {metric} gained
                  </Text>
                  <Flex direction="column" gap="1.5">
                    {Array.from(participantMap.values())
                      .map(userInfo => {
                        const sanguineUser = data.sanguineUsers.find(
                          user => user.nickname === userInfo.nickname,
                        );
                        const totalPoints = data.auditData
                          .filter(
                            audit =>
                              sanguineUser &&
                              audit.destinationDiscordId ===
                                sanguineUser.discordId &&
                              (metric === 'EHB' || metric === 'EHP'
                                ? true
                                : audit.bossName
                                    ?.toLocaleLowerCase()
                                    ?.replaceAll(' ', '_') ===
                                  data.compDetails.metric),
                          )
                          .reduce((sum, audit) => sum + audit.pointsGiven, 0);

                        return {
                          ...userInfo,
                          totalPoints,
                          discordId: sanguineUser?.discordId || '',
                          ratio:
                            userInfo.gained > 0
                              ? totalPoints / userInfo.gained
                              : 0,
                        };
                      })
                      .sort((a, b) => b.ratio - a.ratio)
                      .slice(0, 3)
                      .map((participant, index) => (
                        <Flex
                          key={participant.nickname}
                          justify="between"
                          align="center"
                          onClick={() => navigate(`/users/${participant.discordId}`)}
                          className="cursor-pointer rounded-lg border border-gray-700 px-2 py-1.5 transition-colors hover:border-sanguine-red hover:bg-gray-800/30"
                        >
                          <Flex align="center" gap="2">
                            <Text size="1" className="font-bold text-gray-300">
                              #{index + 1}
                            </Text>
                            <ClickableUserName
                              user={{
                                discordId: participant.discordId,
                                nickname: participant.nickname,
                              }}
                            />
                          </Flex>
                          <Text size="1" className="font-mono text-green-400">
                            {participant.ratio.toFixed(2)}
                          </Text>
                        </Flex>
                      ))}
                  </Flex>
                </Box>

                {/* Most Unlucky - High Metric/Points */}
                <Box className="p-3">
                  <Heading size="3" className="mb-2 text-red-400">
                    Most Unlucky
                  </Heading>
                  <Text size="1" className="mb-2 text-gray-400">
                    Most {metric} per point earned
                  </Text>
                  <Flex direction="column" gap="1.5">
                    {Array.from(participantMap.values())
                      .map(userInfo => {
                        const sanguineUser = data.sanguineUsers.find(
                          user => user.nickname === userInfo.nickname,
                        );
                        const totalPoints = data.auditData
                          .filter(
                            audit =>
                              sanguineUser &&
                              audit.destinationDiscordId ===
                                sanguineUser.discordId &&
                              (metric === 'EHB' || metric === 'EHP'
                                ? true
                                : audit.bossName
                                    ?.toLocaleLowerCase()
                                    ?.replaceAll(' ', '_') ===
                                  data.compDetails.metric),
                          )
                          .reduce((sum, audit) => sum + audit.pointsGiven, 0);

                        return {
                          ...userInfo,
                          totalPoints,
                          discordId: sanguineUser?.discordId || '',
                          ratio:
                            totalPoints > 0
                              ? userInfo.gained / totalPoints
                              : 0,
                        };
                      })
                      .sort((a, b) => b.ratio - a.ratio)
                      .slice(0, 3)
                      .map((participant, index) => (
                        <Flex
                          key={participant.nickname}
                          justify="between"
                          align="center"
                          onClick={() => navigate(`/users/${participant.discordId}`)}
                          className="cursor-pointer rounded-lg border border-gray-700 px-2 py-1.5 transition-colors hover:border-sanguine-red hover:bg-gray-800/30"
                        >
                          <Flex align="center" gap="2">
                            <Text size="1" className="font-bold text-gray-300">
                              #{index + 1}
                            </Text>
                            <ClickableUserName
                              user={{
                                discordId: participant.discordId,
                                nickname: participant.nickname,
                              }}
                            />
                          </Flex>
                          <Text size="1" className="font-mono text-red-400">
                            {participant.ratio.toFixed(2)}
                          </Text>
                        </Flex>
                      ))}
                  </Flex>
                </Box>
              </Flex>
            </Box>
          </Card>
        )}

        {/* Participants Summary */}
        {participantMap.size > 0 && (
          <Card id="leaderboard" className="scroll-mt-6 border border-gray-800 bg-gray-900">
            <Box p="5">
              <Flex justify="between" align="center" className="mb-4">
                <Heading size="5" className="text-white">
                  Event Points Leaderboard
                </Heading>
                <Flex gap="2">
                  <button
                    onClick={() => setSortBy('points')}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      sortBy === 'points'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Points
                  </button>
                  <button
                    onClick={() => setSortBy('metric')}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      sortBy === 'metric'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {metric}
                  </button>
                </Flex>
              </Flex>

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
                          audit.destinationDiscordId ===
                            sanguineUser.discordId &&
                          (metric === 'EHB' || metric === 'EHP'
                            ? true
                            : audit.bossName
                                ?.toLocaleLowerCase()
                                ?.replaceAll(' ', '_') ===
                              data.compDetails.metric),
                      )
                      .reduce((sum, audit) => sum + audit.pointsGiven, 0);

                    return {
                      ...userInfo,
                      totalPoints,
                      discordId: sanguineUser?.discordId || '',
                    };
                  })
                  .sort((a, b) => {
                    if (sortBy === 'points') {
                      return b.totalPoints - a.totalPoints;
                    } else {
                      return b.gained - a.gained;
                    }
                  })
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
