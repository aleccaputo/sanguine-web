import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { getCompetitionById } from '~/services/wom-api-service.server';
import {
  useLoaderData,
  useSearchParams,
  type ShouldRevalidateFunction,
} from '@remix-run/react';
import { Response } from '@remix-run/web-fetch';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAuditDataForDateRange } from '~/data/points-audit';
import {
  fetchOSRSItem,
  type OSRSItem,
} from '~/services/osrs-wiki-prices-service';
import dayjs from 'dayjs';
import { useState, useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
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
import { ParticipantBreakdownDialog } from '~/components/ParticipantBreakdownDialog';
import { ClickableUserName } from '~/components/ClickableUserName';

interface ParticipantInfo {
  discordId: string;
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

export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  const current = new URL(currentUrl);
  const next = new URL(nextUrl);
  current.searchParams.delete('participant');
  next.searchParams.delete('participant');
  if (current.href === next.href) return false;
  return defaultShouldRevalidate;
}

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

  const uniqueItemIds = [
    ...new Set(
      filteredAuditData
        .map(a => a.itemId)
        .filter((id): id is number => id != null),
    ),
  ];
  const itemResults = await Promise.all(
    uniqueItemIds.map(id => fetchOSRSItem(id)),
  );
  const itemDetails = Object.fromEntries(
    uniqueItemIds.flatMap((id, i) => (itemResults[i] ? [[id, itemResults[i]]] : [])),
  ) as Record<number, OSRSItem>;

  return json(
    {
      auditData: filteredAuditData,
      sanguineUsers: sanguineUsers,
      compDetails: womComp,
      itemDetails,
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
  '#BB2C23', // sanguine red
  '#C4943A', // gold
  '#5C8C4A', // forest green
  '#4A7EA8', // steel blue
  '#8B6BAE', // rune purple
  '#C4723C', // bronze
  '#3D8C8C', // teal
  '#A87050', // earth brown
  '#B89828', // amber
  '#6878B8', // slate blue
  '#6A9858', // sage green
  '#B85870', // dusty rose
  '#4A6E98', // denim
  '#987040', // leather
  '#6AAA6A', // medium green
  '#C08858', // tan
  '#4A7880', // deep teal
  '#A87898', // mauve
  '#C06848', // terracotta
  '#7888C8', // periwinkle
  '#5AA888', // seafoam
  '#C0A868', // warm sand
  '#907888', // dusty lavender
  '#58A070', // moss green
  '#B86858', // salmon
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<'points' | 'metric'>('points');
  const [chartTopN, setChartTopN] = useState(10);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  const selectedDiscordId = searchParams.get('participant');
  const selectParticipant = (discordId: string) =>
    setSearchParams({ participant: discordId }, { preventScrollReset: true });
  const clearParticipant = () =>
    setSearchParams({}, { preventScrollReset: true });
  const metric = getMetricType(data.compDetails.metric);
  const compMetric = data.compDetails.metric;

  // Build participant map with competition data, including discordId for downstream lookups
  const participantMap = useMemo(() => {
    const map = new Map<string, ParticipantInfo>();
    data.compDetails.participations.forEach(participation => {
      const sanguineUser = data.sanguineUsers.find(
        user =>
          user.nickname?.toLowerCase().trim() ===
          participation.player.displayName.toLowerCase().trim(),
      );
      if (sanguineUser?.nickname) {
        map.set(sanguineUser.discordId, {
          discordId: sanguineUser.discordId,
          nickname: sanguineUser.nickname,
          displayName: participation.player.displayName,
          startProgress: participation.progress.start,
          endProgress: participation.progress.end,
          gained: participation.progress.gained,
        });
      }
    });
    return map;
  }, [data]);

  // Build cumulative chart data: pre-group audit by (discordId, unit) in O(A),
  // then accumulate running totals in O(P×U) instead of O(P×U²)
  const { cumulativeData, useHourly } = useMemo(() => {
    const startDate = dayjs(data.compDetails.startsAt);
    const endDate = dayjs(data.compDetails.endsAt);
    const chartEndDate = endDate.isBefore(dayjs()) ? endDate : dayjs();
    const days = Math.max(0, chartEndDate.diff(startDate, 'days') + 1);
    const hourly = days <= 2;
    const chartUnits = hourly
      ? Math.max(0, chartEndDate.diff(startDate, 'hours') + 1)
      : days;

    const auditByKey = new Map<string, number>();
    for (const audit of data.auditData) {
      if (!audit.destinationDiscordId) continue;
      const isMatch =
        metric === 'EHB' || metric === 'EHP'
          ? true
          : audit.bossName?.toLowerCase().replaceAll(' ', '_') === compMetric;
      if (!isMatch) continue;
      const unitKey = hourly
        ? dayjs(audit.createdAt).format('DD/MM/YYYY HH')
        : dayjs(audit.createdAt).format('DD/MM/YYYY');
      const key = `${audit.destinationDiscordId}:${unitKey}`;
      auditByKey.set(key, (auditByKey.get(key) ?? 0) + audit.pointsGiven);
    }

    const runningTotals = new Map(
      [...participantMap.keys()].map(id => [id, 0] as [string, number]),
    );
    const cumulativeDataArr: ChartData[] = [];

    for (let i = 0; i < chartUnits; i++) {
      const currentUnit = hourly
        ? startDate.add(i, 'hours')
        : startDate.add(i, 'days');
      const unitLabel = hourly
        ? currentUnit.format('MMM D ha')
        : currentUnit.format('MMM DD');
      const unitKey = hourly
        ? currentUnit.format('DD/MM/YYYY HH')
        : currentUnit.format('DD/MM/YYYY');
      const cumDay: ChartData = { name: unitLabel };

      participantMap.forEach((userInfo, discordId) => {
        const points = auditByKey.get(`${discordId}:${unitKey}`) ?? 0;
        const cumulative = (runningTotals.get(discordId) ?? 0) + points;
        runningTotals.set(discordId, cumulative);
        cumDay[`${userInfo.nickname}_points`] = cumulative;
      });

      cumulativeDataArr.push(cumDay);
    }

    return { cumulativeData: cumulativeDataArr, useHourly: hourly };
  }, [data, participantMap, metric, compMetric]);

  // Pre-compute per-participant event points once for spoon stats and leaderboard
  const participantPoints = useMemo(() => {
    const pointsMap = new Map<string, number>();
    for (const audit of data.auditData) {
      if (!audit.destinationDiscordId || !participantMap.has(audit.destinationDiscordId)) continue;
      const isMatch =
        metric === 'EHB' || metric === 'EHP'
          ? true
          : audit.bossName?.toLowerCase().replaceAll(' ', '_') === compMetric;
      if (!isMatch) continue;
      pointsMap.set(
        audit.destinationDiscordId,
        (pointsMap.get(audit.destinationDiscordId) ?? 0) + audit.pointsGiven,
      );
    }
    return pointsMap;
  }, [data, participantMap, metric, compMetric]);

  const chartParticipants = useMemo(() => {
    const finalDay = cumulativeData[cumulativeData.length - 1];
    return [...participantMap.values()]
      .sort((a, b) => {
        const aPoints = finalDay ? ((finalDay[`${a.nickname}_points`] as number) || 0) : 0;
        const bPoints = finalDay ? ((finalDay[`${b.nickname}_points`] as number) || 0) : 0;
        return bPoints - aPoints;
      })
      .slice(0, chartTopN)
      .map((userInfo, index) => ({
        ...userInfo,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [cumulativeData, participantMap, chartTopN]);

  // Breakdown dialog derived data
  const selectedParticipantInfo = selectedDiscordId
    ? (participantMap.get(selectedDiscordId) ?? null)
    : null;

  const selectedTotalPoints = selectedDiscordId
    ? (participantPoints.get(selectedDiscordId) ?? 0)
    : 0;

  const breakdownDrops = useMemo(() => {
    if (!selectedDiscordId) return [];
    return data.auditData
      .filter(
        a =>
          a.destinationDiscordId === selectedDiscordId &&
          (metric === 'EHB' || metric === 'EHP'
            ? true
            : a.bossName?.toLowerCase().replaceAll(' ', '_') === compMetric),
      )
      .map(a => ({
        ...a,
        osrsData: a.itemId != null ? (data.itemDetails[a.itemId] ?? null) : null,
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedDiscordId, data.auditData, data.itemDetails, metric, compMetric]);

  const breakdownChartData = useMemo(() => {
    if (!selectedParticipantInfo) return [];
    return cumulativeData.map(day => ({
      name: day.name,
      points: (day[`${selectedParticipantInfo.nickname}_points`] as number) || 0,
    }));
  }, [cumulativeData, selectedParticipantInfo]);

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
            <Flex justify="between" align="center" className="mb-4">
              <Flex direction="column" gap="1">
                <Heading size="5" className="text-white">
                  {useHourly ? 'Hourly Points Progress' : 'Daily Points Progress'}
                </Heading>
                {participantMap.size > 0 && (
                  <Text size="1" className="text-gray-400">
                    Showing top {Math.min(chartTopN, participantMap.size)} of {participantMap.size} participants
                  </Text>
                )}
              </Flex>
              {participantMap.size > 5 && (
                <Flex gap="2">
                  {([5, 10, 25] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setChartTopN(n)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        chartTopN === n
                          ? 'bg-sanguine-red text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Top {n}
                    </button>
                  ))}
                </Flex>
              )}
            </Flex>

            {participantMap.size > 0 ? (
              <Box className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} onMouseLeave={() => setHoveredLine(null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="name"
                      stroke="#9CA3AF"
                      fontSize={12}
                      interval={useHourly ? 5 : 0}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const sorted = [...payload]
                          .sort((a, b) => ((b.value as number) ?? 0) - ((a.value as number) ?? 0));
                        const hoveredIndex = hoveredLine
                          ? sorted.findIndex(p => p.dataKey === hoveredLine)
                          : 0;
                        const start = Math.max(0, hoveredIndex - 2);
                        const end = Math.min(sorted.length, hoveredIndex + 3);
                        const visible = sorted.slice(start, end);
                        return (
                          <div style={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#F9FAFB', minWidth: '160px' }}>
                            <div style={{ color: '#9CA3AF', marginBottom: '6px', fontSize: '11px' }}>{label}</div>
                            {start > 0 && <div style={{ color: '#6B7280', marginBottom: '3px', fontSize: '11px' }}>↑ {start} more</div>}
                            {visible.map((entry, i) => {
                              const rank = start + i + 1;
                              const isHovered = entry.dataKey === hoveredLine;
                              const name = (entry.dataKey as string).replace('_points', '');
                              return (
                                <div key={String(entry.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontWeight: isHovered ? 600 : 400, opacity: isHovered ? 1 : 0.7, backgroundColor: isHovered ? `${entry.stroke}22` : 'transparent', borderRadius: '4px', padding: '2px 4px', margin: '0 -4px 3px' }}>
                                  <span style={{ color: '#6B7280', fontSize: '11px', minWidth: '20px' }}>#{rank}</span>
                                  <span style={{ color: entry.stroke as string }}>●</span>
                                  <span style={{ flex: 1 }}>{name}</span>
                                  <span style={{ color: '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>{entry.value}</span>
                                </div>
                              );
                            })}
                            {end < sorted.length && <div style={{ color: '#6B7280', marginTop: '3px', fontSize: '11px' }}>↓ {sorted.length - end} more</div>}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      formatter={value =>
                        typeof value === 'string' ? value.replace('_points', '') : value
                      }
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    />
                    {chartParticipants.map(participant => {
                      const key = `${participant.nickname}_points`;
                      const isHovered = hoveredLine === key;
                      const isDimmed = hoveredLine !== null && !isHovered;
                      return (
                        <Line
                          key={key}
                          type="stepAfter"
                          dataKey={key}
                          stroke={participant.color}
                          strokeWidth={isHovered ? 3 : 2}
                          strokeOpacity={isDimmed ? 0.15 : 1}
                          dot={false}
                          activeDot={isDimmed ? false : { r: 5 }}
                          onMouseEnter={() => setHoveredLine(key)}
                        />
                      );
                    })}
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
                        const totalPoints = participantPoints.get(userInfo.discordId) ?? 0;
                        return {
                          ...userInfo,
                          totalPoints,
                          ratio: userInfo.gained > 0 ? totalPoints / userInfo.gained : 0,
                        };
                      })
                      .sort((a, b) => b.ratio - a.ratio)
                      .slice(0, 3)
                      .map((participant, index) => (
                        <Flex
                          key={participant.nickname}
                          justify="between"
                          align="center"
                          onClick={() => selectParticipant(participant.discordId)}
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
                        const totalPoints = participantPoints.get(userInfo.discordId) ?? 0;
                        return {
                          ...userInfo,
                          totalPoints,
                          ratio: totalPoints > 0 ? userInfo.gained / totalPoints : 0,
                        };
                      })
                      .sort((a, b) => b.ratio - a.ratio)
                      .slice(0, 3)
                      .map((participant, index) => (
                        <Flex
                          key={participant.nickname}
                          justify="between"
                          align="center"
                          onClick={() => selectParticipant(participant.discordId)}
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
                  .map(userInfo => ({
                    ...userInfo,
                    totalPoints: participantPoints.get(userInfo.discordId) ?? 0,
                  }))
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
                      onSelect={selectParticipant}
                    />
                  ))}
              </Flex>
            </Box>
          </Card>
        )}
      </Flex>

      {selectedParticipantInfo && selectedDiscordId && (
        <ParticipantBreakdownDialog
          discordId={selectedDiscordId}
          nickname={selectedParticipantInfo.nickname}
          gained={selectedParticipantInfo.gained}
          totalPoints={selectedTotalPoints}
          metric={metric}
          drops={breakdownDrops}
          chartData={breakdownChartData}
          onClose={clearParticipant}
        />
      )}
    </Container>
  );
};

export default EventById;
