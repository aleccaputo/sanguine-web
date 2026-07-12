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
import { getAllUserAlts } from '~/data/user';
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
import { Text, Container, Box, Flex } from '@radix-ui/themes';
import { getCompetitionImageUrl, getMetricType } from '~/utils/competition-images';
import { isClanPointAudit } from '~/utils/point-types';
import { ParticipantBreakdownDialog } from '~/components/ParticipantBreakdownDialog';
import { ClickableUserName } from '~/components/ClickableUserName';
import { ArticleTitle } from '~/components/ArticleTitle';
import { ChipGroup } from '~/components/ChipGroup';
import { ContentsBox } from '~/components/ContentsBox';
import { EmptyState } from '~/components/EmptyState';
import { Infobox, InfoboxBand, InfoboxRow } from '~/components/Infobox';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { rankBadge } from '~/components/PbTeam';
import { buildAltsByDiscordId } from '~/utils/account-matching';
import { EVENTS_EXCLUDED_DISCORD_IDS } from '~/utils/events-config';
import { proseLinkClass, zebraRowClass } from '~/utils/styles';

interface ParticipantInfo {
  participantKey: string;
  discordId: string;
  nickname: string;
  displayName: string;
  isAlt: boolean;
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
  const userAltsPromise = getAllUserAlts();

  const [sanguineUsers, pointAudit, userAlts] = await Promise.all([
    sanguineUsersPromise,
    pointAuditPromise,
    userAltsPromise,
  ]);

  // ONE_TIME awards and clan-bucket payouts (raids, manual clan adjustments, post-cutover
  // competition rewards) don't count toward event drop totals — same exclusion the bot applies
  // to its monthly leaderboard.
  const filteredAuditData = pointAudit.filter(
    x => x.type !== 'ONE_TIME' && !isClanPointAudit(x),
  );

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
    uniqueItemIds.flatMap((id, i) =>
      itemResults[i] ? [[id, itemResults[i]]] : [],
    ),
  ) as Record<number, OSRSItem>;

  return json(
    {
      auditData: filteredAuditData,
      sanguineUsers,
      compDetails: womComp,
      itemDetails,
      userAlts,
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

const TITLE_CASE_LOWERCASE_WORDS = new Set(['of', 'the', 'a', 'an']);

const humanizeMetric = (metric: string) =>
  // Acronym metrics (ehb, ehp) read fully uppercased, not title-cased
  ['ehb', 'ehp'].includes(metric)
    ? metric.toUpperCase()
    : metric
        .split('_')
        .map((part, i) => {
          if (!part.length) return part;
          if (i > 0 && TITLE_CASE_LOWERCASE_WORDS.has(part)) return part;
          return part[0].toUpperCase() + part.slice(1);
        })
        .join(' ');

/**
 * Given an audit record's discordId and osrsName, find which participant entry it belongs to.
 * For alts, osrsName matches the alt's displayName. For mains, osrsName is null or matches
 * the main nickname. Uses the altKeyLookup for O(1) alt resolution.
 */
const resolveParticipantKey = (
  discordId: string,
  osrsName: string | null,
  participantMap: Map<string, ParticipantInfo>,
  altKeyLookup?: Map<string, string>,
): string | null => {
  if (osrsName && altKeyLookup) {
    const altKey = altKeyLookup.get(
      `${discordId}:${osrsName.toLowerCase().trim()}`,
    );
    if (altKey) return altKey;
  }

  // Fall back to main account entry
  return participantMap.has(discordId) ? discordId : null;
};

const matchesMetric = (
  audit: { bossName?: string | null },
  metric: string,
  compMetric: string,
): boolean =>
  metric === 'EHB' || metric === 'EHP'
    ? true
    : audit.bossName?.toLowerCase().replaceAll(' ', '_') === compMetric;

// Status stays inside the palette: active reads friends-list green, upcoming
// plain white, completed muted.
const getEventStatus = (startsAt: string, endsAt: string): EventStatus => {
  const now = new Date();
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (now < start) return { status: 'Upcoming', color: 'text-gray-200' };
  if (now > end) return { status: 'Completed', color: 'text-gray-500' };
  return { status: 'Active', color: 'text-green-400' };
};

const leaderboardGridClass =
  'grid grid-cols-[32px_1fr_88px_72px] items-center gap-2 px-2 md:grid-cols-[40px_1fr_110px_90px] md:gap-3 md:px-3';

const EventById = () => {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<'points' | 'metric'>('points');
  const [chartTopN, setChartTopN] = useState(10);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  const selectedParticipantKey = searchParams.get('participant');
  const selectParticipant = (participantKey: string) =>
    setSearchParams(
      { participant: participantKey },
      { preventScrollReset: true },
    );
  const clearParticipant = () =>
    setSearchParams({}, { preventScrollReset: true });
  const metric = getMetricType(data.compDetails.metric);
  const compMetric = data.compDetails.metric;

  // Build participant map with competition data — main and alt accounts are separate entries
  const participantMap = useMemo(() => {
    const altsByDiscordId = buildAltsByDiscordId(data.userAlts);
    // Reverse lookup: lowercased alt name -> { discordId, mainNickname }
    const altOwners = new Map(
      data.sanguineUsers
        .filter(user => user.nickname && altsByDiscordId.has(user.discordId))
        .flatMap(user =>
          [...altsByDiscordId.get(user.discordId)!].map(
            altNameLower =>
              [
                altNameLower,
                { discordId: user.discordId, mainNickname: user.nickname! },
              ] as const,
          ),
        ),
    );

    return data.compDetails.participations.reduce((map, participation) => {
      const rsn = participation.player.displayName.toLowerCase().trim();
      const progress = participation.progress;

      // Try matching as a main account first
      const mainUser = data.sanguineUsers.find(
        user => user.nickname?.toLowerCase().trim() === rsn,
      );
      if (mainUser?.nickname) {
        if (EVENTS_EXCLUDED_DISCORD_IDS.has(mainUser.discordId)) return map;
        map.set(mainUser.discordId, {
          participantKey: mainUser.discordId,
          discordId: mainUser.discordId,
          nickname: mainUser.nickname,
          displayName: participation.player.displayName,
          isAlt: false,
          startProgress: progress.start,
          endProgress: progress.end,
          gained: progress.gained,
        });
        return map;
      }

      // Try matching as an alt account
      const altInfo = altOwners.get(rsn);
      if (altInfo && !EVENTS_EXCLUDED_DISCORD_IDS.has(altInfo.discordId)) {
        const altName = participation.player.displayName;
        const key = `${altInfo.discordId}:${altName}`;
        map.set(key, {
          participantKey: key,
          discordId: altInfo.discordId,
          nickname: `${altName} (${altInfo.mainNickname})`,
          displayName: altName,
          isAlt: true,
          startProgress: progress.start,
          endProgress: progress.end,
          gained: progress.gained,
        });
      }
      return map;
    }, new Map<string, ParticipantInfo>());
  }, [data]);

  // Reverse lookup: "discordId:altNameLower" -> participantKey for O(1) audit routing
  const altKeyLookup = useMemo(
    () =>
      [...participantMap.entries()]
        .filter(([, info]) => info.isAlt)
        .reduce(
          (map, [key, info]) =>
            map.set(
              `${info.discordId}:${info.displayName.toLowerCase().trim()}`,
              key,
            ),
          new Map<string, string>(),
        ),
    [participantMap],
  );

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

    // Map each audit record to a participant key based on discordId + osrsName
    const auditByKey = data.auditData
      .filter(
        audit =>
          audit.destinationDiscordId &&
          matchesMetric(audit, metric, compMetric),
      )
      .reduce((map, audit) => {
        const pKey = resolveParticipantKey(
          audit.destinationDiscordId!,
          audit.osrsName,
          participantMap,
          altKeyLookup,
        );
        if (!pKey) return map;

        const unitKey = hourly
          ? dayjs(audit.createdAt).format('DD/MM/YYYY HH')
          : dayjs(audit.createdAt).format('DD/MM/YYYY');
        const compositeKey = `${pKey}:${unitKey}`;
        return map.set(
          compositeKey,
          (map.get(compositeKey) ?? 0) + audit.pointsGiven,
        );
      }, new Map<string, number>());

    const runningTotals = new Map(
      [...participantMap.keys()].map(id => [id, 0] as [string, number]),
    );

    const cumulativeDataArr = Array.from({ length: chartUnits }, (_, i) => {
      const currentUnit = hourly
        ? startDate.add(i, 'hours')
        : startDate.add(i, 'days');
      const unitKey = hourly
        ? currentUnit.format('DD/MM/YYYY HH')
        : currentUnit.format('DD/MM/YYYY');

      const cumDay: ChartData = {
        name: hourly
          ? currentUnit.format('MMM D ha')
          : currentUnit.format('MMM DD'),
      };

      participantMap.forEach((userInfo, pKey) => {
        const points = auditByKey.get(`${pKey}:${unitKey}`) ?? 0;
        const cumulative = (runningTotals.get(pKey) ?? 0) + points;
        runningTotals.set(pKey, cumulative);
        cumDay[`${userInfo.nickname}_points`] = cumulative;
      });

      return cumDay;
    });

    return { cumulativeData: cumulativeDataArr, useHourly: hourly };
  }, [data, participantMap, altKeyLookup, metric, compMetric]);

  // Pre-compute per-participant event points once for spoon stats and leaderboard
  const participantPoints = useMemo(() => {
    return data.auditData
      .filter(
        audit =>
          audit.destinationDiscordId &&
          matchesMetric(audit, metric, compMetric),
      )
      .reduce((map, audit) => {
        const pKey = resolveParticipantKey(
          audit.destinationDiscordId!,
          audit.osrsName,
          participantMap,
          altKeyLookup,
        );
        if (!pKey) return map;
        return map.set(pKey, (map.get(pKey) ?? 0) + audit.pointsGiven);
      }, new Map<string, number>());
  }, [data, participantMap, altKeyLookup, metric, compMetric]);

  const chartParticipants = useMemo(() => {
    const finalDay = cumulativeData[cumulativeData.length - 1];
    return [...participantMap.values()]
      .sort((a, b) => {
        const aPoints = finalDay
          ? (finalDay[`${a.nickname}_points`] as number) || 0
          : 0;
        const bPoints = finalDay
          ? (finalDay[`${b.nickname}_points`] as number) || 0
          : 0;
        return bPoints - aPoints;
      })
      .slice(0, chartTopN)
      .map((userInfo, index) => ({
        ...userInfo,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [cumulativeData, participantMap, chartTopN]);

  // Breakdown dialog derived data
  const selectedParticipantInfo = selectedParticipantKey
    ? participantMap.get(selectedParticipantKey) ?? null
    : null;

  const selectedTotalPoints = selectedParticipantKey
    ? participantPoints.get(selectedParticipantKey) ?? 0
    : 0;

  const breakdownDrops = useMemo(() => {
    if (!selectedParticipantKey) return [];
    return data.auditData
      .filter(
        a =>
          a.destinationDiscordId &&
          matchesMetric(a, metric, compMetric) &&
          resolveParticipantKey(
            a.destinationDiscordId,
            a.osrsName,
            participantMap,
            altKeyLookup,
          ) === selectedParticipantKey,
      )
      .map(a => ({
        ...a,
        osrsData: a.itemId != null ? data.itemDetails[a.itemId] ?? null : null,
      }))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [
    selectedParticipantKey,
    data.auditData,
    data.itemDetails,
    metric,
    compMetric,
    participantMap,
    altKeyLookup,
  ]);

  const breakdownChartData = useMemo(() => {
    if (!selectedParticipantInfo) return [];
    return cumulativeData.map(day => ({
      name: day.name,
      points:
        (day[`${selectedParticipantInfo.nickname}_points`] as number) || 0,
    }));
  }, [cumulativeData, selectedParticipantInfo]);

  const eventStatus = getEventStatus(
    data.compDetails.startsAt,
    data.compDetails.endsAt,
  );

  // Spoon boards, shared by the lede and the Spoons section
  const spoonBoards = useMemo(() => {
    const withRatios = [...participantMap.values()].map(userInfo => {
      const totalPoints = participantPoints.get(userInfo.participantKey) ?? 0;
      return { ...userInfo, totalPoints };
    });
    return {
      lucky: withRatios
        .map(p => ({
          ...p,
          ratio: p.gained > 0 ? p.totalPoints / p.gained : 0,
        }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3),
      unlucky: withRatios
        .map(p => ({
          ...p,
          ratio: p.totalPoints > 0 ? p.gained / p.totalPoints : 0,
        }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3),
    };
  }, [participantMap, participantPoints]);

  const leaderboardRows = useMemo(
    () =>
      [...participantMap.values()]
        .map(userInfo => ({
          ...userInfo,
          totalPoints: participantPoints.get(userInfo.participantKey) ?? 0,
        }))
        .sort((a, b) =>
          sortBy === 'points'
            ? b.totalPoints - a.totalPoints
            : b.gained - a.gained,
        ),
    [participantMap, participantPoints, sortBy],
  );

  const totalEventPoints = [...participantPoints.values()].reduce(
    (sum, points) => sum + points,
    0,
  );
  // Lede leader is always by points, regardless of the leaderboard's toggle
  const pointsLeader = [...participantMap.values()]
    .map(userInfo => ({
      ...userInfo,
      totalPoints: participantPoints.get(userInfo.participantKey) ?? 0,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)[0];

  const hasParticipants = participantMap.size > 0;
  const sections = [
    { id: 'chart', title: 'Progress' },
    ...(hasParticipants
      ? [
          { id: 'spoons', title: 'Spoon statistics' },
          { id: 'leaderboard', title: 'Leaderboard' },
        ]
      : []),
  ];

  const competingVerb =
    eventStatus.status === 'Active'
      ? 'are competing'
      : eventStatus.status === 'Upcoming'
        ? 'are signed up'
        : 'took part';

  const womUrl = `https://wiseoldman.net/competitions/${data.compDetails.id}`;
  const dateLabels =
    eventStatus.status === 'Upcoming'
      ? { start: 'Starts', end: 'Ends' }
      : eventStatus.status === 'Active'
        ? { start: 'Started', end: 'Ends' }
        : { start: 'Started', end: 'Ended' };

  return (
    <Container size="4" mt="3" pb="6">
      {/* The event's page is its wiki article: title over a hairline, an infobox
          with the vitals, a prose lede, a contents box, then sections. */}
      <ArticleTitle title={data.compDetails.title} />

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:gap-8">
        <Infobox>
          <InfoboxBand primary>{data.compDetails.title}</InfoboxBand>
          <Flex
            direction="column"
            align="center"
            gap="1"
            className="bg-sanguine-red/[0.04] px-3 py-5"
          >
            <img
              src={getCompetitionImageUrl(compMetric)}
              alt=""
              className="h-14 w-14 object-contain"
            />
            <Text size="2" className="text-gray-400">
              {humanizeMetric(compMetric)}
            </Text>
          </Flex>
          <dl>
            <InfoboxRow label="Status" valueClassName={eventStatus.color}>
              {eventStatus.status}
            </InfoboxRow>
            <InfoboxRow label={dateLabels.start}>
              {formatDate(data.compDetails.startsAt)}
            </InfoboxRow>
            <InfoboxRow label={dateLabels.end}>
              {formatDate(data.compDetails.endsAt)}
            </InfoboxRow>
            {hasParticipants && (
              <InfoboxRow label="Participants" valueClassName="text-white">
                {participantMap.size}
              </InfoboxRow>
            )}
            {totalEventPoints > 0 && (
              <InfoboxRow label="Drop points" valueClassName="text-white">
                {totalEventPoints.toLocaleString()}
              </InfoboxRow>
            )}
            <InfoboxRow label="Tracked on">
              <a
                href={womUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={proseLinkClass}
              >
                Wise Old Man
              </a>
            </InfoboxRow>
          </dl>
        </Infobox>

        <Box className="min-w-0 flex-1">
          {/* Lede — the event narrated from what actually happened */}
          <Text as="p" size="3" className="mt-6 leading-7 text-gray-300">
            <strong className="font-medium text-white">
              {data.compDetails.title}
            </strong>{' '}
            is a Sanguine competition tracked on{' '}
            <a
              href={womUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={proseLinkClass}
            >
              Wise Old Man
            </a>
            , running {formatDate(data.compDetails.startsAt)} –{' '}
            {formatDate(data.compDetails.endsAt)}.
            {hasParticipants && (
              <>
                {' '}
                <span className="text-white">{participantMap.size}</span>{' '}
                member accounts {competingVerb}
                {totalEventPoints > 0 && (
                  <>
                    , producing{' '}
                    <span className="text-white">
                      {totalEventPoints.toLocaleString()} drop points
                    </span>{' '}
                    so far
                  </>
                )}
                .
              </>
            )}
            {hasParticipants &&
              pointsLeader &&
              pointsLeader.totalPoints > 0 && (
                <>
                  {' '}
                  <ClickableUserName
                    user={{
                      discordId: pointsLeader.discordId,
                      nickname: pointsLeader.nickname,
                    }}
                  />{' '}
                  leads the board with{' '}
                  <span className="text-white">
                    {pointsLeader.totalPoints.toLocaleString()} points
                  </span>
                  .
                </>
              )}
            {!hasParticipants && <> So far, nothing interesting happens.</>}
          </Text>

          {sections.length > 1 && <ContentsBox sections={sections} />}

          {/* Progress chart */}
          <section id="chart" className="mt-10 scroll-mt-20">
            <SectionHeading
              title={useHourly ? 'Hourly progress' : 'Daily progress'}
              summary={
                hasParticipants ? (
                  <Text size="2" className="text-gray-500">
                    top{' '}
                    <span className="text-white">
                      {Math.min(chartTopN, participantMap.size)}
                    </span>{' '}
                    of {participantMap.size} participants
                  </Text>
                ) : undefined
              }
            />
            {participantMap.size > 5 && (
              <Box mt="3">
                <ChipGroup
                  options={([5, 10, 25] as const).map(n => ({
                    key: String(n),
                    label: `Top ${n}`,
                  }))}
                  value={String(chartTopN)}
                  onChange={key => setChartTopN(Number(key))}
                />
              </Box>
            )}

            {hasParticipants ? (
              <Box className="mt-3 h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={cumulativeData}
                    onMouseLeave={() => setHoveredLine(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
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
                        const sorted = [...payload].sort(
                          (a, b) =>
                            ((b.value as number) ?? 0) -
                            ((a.value as number) ?? 0),
                        );
                        const hoveredIndex = hoveredLine
                          ? sorted.findIndex(p => p.dataKey === hoveredLine)
                          : 0;
                        const start = Math.max(0, hoveredIndex - 2);
                        const end = Math.min(sorted.length, hoveredIndex + 3);
                        const visible = sorted.slice(start, end);
                        return (
                          <div
                            style={{
                              backgroundColor: '#111113',
                              border: '1px solid #374151',
                              borderRadius: '2px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              color: '#F9FAFB',
                              minWidth: '160px',
                            }}
                          >
                            <div
                              style={{
                                color: '#9CA3AF',
                                marginBottom: '6px',
                                fontSize: '11px',
                              }}
                            >
                              {label}
                            </div>
                            {start > 0 && (
                              <div
                                style={{
                                  color: '#6B7280',
                                  marginBottom: '3px',
                                  fontSize: '11px',
                                }}
                              >
                                ↑ {start} more
                              </div>
                            )}
                            {visible.map((entry, i) => {
                              const rank = start + i + 1;
                              const isHovered = entry.dataKey === hoveredLine;
                              const name = (entry.dataKey as string).replace(
                                '_points',
                                '',
                              );
                              return (
                                <div
                                  key={String(entry.dataKey)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '3px',
                                    fontWeight: isHovered ? 600 : 400,
                                    opacity: isHovered ? 1 : 0.7,
                                    backgroundColor: isHovered
                                      ? `${entry.stroke}22`
                                      : 'transparent',
                                    padding: '2px 4px',
                                    margin: '0 -4px 3px',
                                  }}
                                >
                                  <span
                                    style={{
                                      color: '#6B7280',
                                      fontSize: '11px',
                                      minWidth: '20px',
                                    }}
                                  >
                                    #{rank}
                                  </span>
                                  <span
                                    style={{ color: entry.stroke as string }}
                                  >
                                    ●
                                  </span>
                                  <span style={{ flex: 1 }}>{name}</span>
                                  <span
                                    style={{
                                      color: '#D1D5DB',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {entry.value}
                                  </span>
                                </div>
                              );
                            })}
                            {end < sorted.length && (
                              <div
                                style={{
                                  color: '#6B7280',
                                  marginTop: '3px',
                                  fontSize: '11px',
                                }}
                              >
                                ↓ {sorted.length - end} more
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      formatter={value =>
                        typeof value === 'string'
                          ? value.replace('_points', '')
                          : value
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
              <EmptyState>
                No Sanguine participants found in this competition
              </EmptyState>
            )}
          </section>

          {/* Spoon statistics */}
          {hasParticipants && (
            <section id="spoons" className="mt-10 scroll-mt-20">
              <SectionHeading title="Spoon statistics" />
              <div className="mt-1 grid grid-cols-1 gap-x-8 md:grid-cols-2">
                {(
                  [
                    {
                      key: 'lucky',
                      title: 'Biggest spoons',
                      hint: `most points per ${metric}`,
                      valueClass: 'text-green-400',
                      rows: spoonBoards.lucky,
                    },
                    {
                      key: 'unlucky',
                      title: 'Most unlucky',
                      hint: `most ${metric} per point`,
                      valueClass: 'text-red-400',
                      rows: spoonBoards.unlucky,
                    },
                  ] as const
                ).map(board => (
                  <Box key={board.key} className="min-w-0">
                    <SubsectionHeading title={board.title} hint={board.hint} />
                    <Box>
                      {board.rows.map((participant, index) => (
                        <Flex
                          key={participant.participantKey}
                          justify="between"
                          align="center"
                          gap="3"
                          onClick={() =>
                            selectParticipant(participant.participantKey)
                          }
                          className={`cursor-pointer px-2 py-1.5 ${zebraRowClass}`}
                        >
                          <Flex align="center" gap="2" className="min-w-0">
                            <Text
                              size="2"
                              className="w-5 shrink-0 text-right text-gray-600"
                            >
                              {index + 1}
                            </Text>
                            <ClickableUserName
                              user={{
                                discordId: participant.discordId,
                                nickname: participant.nickname,
                              }}
                              size="2"
                              className="truncate text-sanguine-bright"
                            />
                          </Flex>
                          <Text
                            size="2"
                            className={`shrink-0 tabular-nums ${board.valueClass}`}
                          >
                            {participant.ratio.toFixed(2)}
                          </Text>
                        </Flex>
                      ))}
                    </Box>
                  </Box>
                ))}
              </div>
            </section>
          )}

          {/* Leaderboard */}
          {hasParticipants && (
            <section id="leaderboard" className="mt-10 scroll-mt-20">
              <SectionHeading
                title="Leaderboard"
                summary={
                  <Text size="2" className="text-gray-500">
                    <span className="text-white">{leaderboardRows.length}</span>{' '}
                    entrants
                  </Text>
                }
              />
              <Box mt="3">
                <ChipGroup
                  options={[
                    { key: 'points', label: 'Points' },
                    { key: 'metric', label: metric },
                  ]}
                  value={sortBy}
                  onChange={key => setSortBy(key as 'points' | 'metric')}
                />
              </Box>

              <Box mt="2">
                <div
                  className={`${leaderboardGridClass} border-b border-gray-700 py-2.5 text-sm text-osrs-orange`}
                >
                  <span className="text-right">#</span>
                  <span>Member</span>
                  <span className="text-right">{metric}</span>
                  <span className="text-right">Points</span>
                </div>
                {leaderboardRows.map((participant, index) => (
                  <div
                    key={participant.participantKey}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      selectParticipant(participant.participantKey)
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectParticipant(participant.participantKey);
                      }
                    }}
                    className={`${leaderboardGridClass} group cursor-pointer py-2 ${zebraRowClass}`}
                  >
                    <Text
                      as="div"
                      size="2"
                      className="whitespace-nowrap text-right text-white"
                    >
                      {index < 3 ? rankBadge(index + 1) : `${index + 1}`}
                    </Text>
                    <Text
                      as="div"
                      className="min-w-0 truncate leading-tight text-sanguine-bright group-hover:text-white"
                    >
                      {participant.nickname}
                    </Text>
                    <Text
                      as="div"
                      size="2"
                      className="text-right tabular-nums text-gray-200"
                    >
                      {participant.gained.toLocaleString()}
                    </Text>
                    <Text
                      as="div"
                      className={`text-right ${
                        participant.totalPoints === 0
                          ? 'text-gray-600'
                          : 'text-white'
                      }`}
                    >
                      {participant.totalPoints.toLocaleString()}
                    </Text>
                  </div>
                ))}
              </Box>
            </section>
          )}
        </Box>
      </div>

      {selectedParticipantInfo && selectedParticipantKey && (
        <ParticipantBreakdownDialog
          discordId={selectedParticipantInfo.discordId}
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
