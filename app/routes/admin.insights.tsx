import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  isRouteErrorResponse,
  Link,
  useFetcher,
  useLoaderData,
  useRouteError,
  useSearchParams,
} from '@remix-run/react';
import {
  Box,
  Flex,
  Heading,
  Select,
  Table,
  Tabs,
  Text,
} from '@radix-ui/themes';
import dayjs from 'dayjs';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '~/components/button';
import {
  CompositionBar,
  DivergingBars,
  DumbbellChart,
  HorizontalBars,
  SmallMultiples,
} from '~/components/EngagementCharts';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { requireModerator } from '~/services/auth.server';
import {
  getBountyListings,
  getEngagementEvents,
  getInGameActivityByDiscordId,
} from '~/services/engagement-service.server';
import type {
  IBountyListing,
  IBountyScorecardResult,
} from '~/services/engagement-service.server';
import { getRsnMemberBridge } from '~/services/member-lookup.server';
import { BOUNTY_STATUS } from '~/utils/bounty';
import { rankLabel } from '~/utils/clan-ranks';
import {
  ENGAGEMENT_SYSTEM_LABELS,
  ENGAGEMENT_SYSTEM_SHORT_LABELS,
  ENGAGEMENT_SYSTEM_UNITS,
  ENGAGEMENT_SYSTEMS,
  EngagementSystem,
  IInactiveMember,
  lastEventAtByMember,
  monthlyEngagementSeries,
  parsePvmPeriodDays,
  PVM_METRICS,
  pvmFloorForDays,
  PVM_PERIOD_DAYS,
  summarizeEngagement,
  topMembersBySystem,
  summarizeInactivity,
} from '~/utils/engagement';
import {
  clanSystemActiveByMonth,
  IMonthlyFlow,
  median,
  monthlyFlows,
  summarizeReach,
} from '~/utils/engagement-stats';
import { jumpToSection } from '~/utils/jump-to-section';
import { proseLinkClass, zebraStripeClass } from '~/utils/styles';
import type { loader as bountyScorecardLoader } from './admin.insights_.bounty.$id';
import type { loader as pvmActivityLoader } from './admin.insights_.pvm';
import type { loader as skillingLoader } from './admin.insights_.skilling';
import type { loader as monthsLoader } from './admin.insights_.months';

export const meta: MetaFunction = () => [{ title: 'Clan insights' }];

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_SHOWN = 6;
const MOST_ENGAGED_SHOWN = 25;
const TOP_PER_SYSTEM = 5;
// How many bounty scorecards load on their own before the rest wait for a click, so a visit
// costs a bounded number of WOM reads.
const AUTO_MEASURED_BOUNTIES = 2;

// Everything except the WOM gains, which the two resource routes serve on demand. The cached
// WOM membership list is read once for in-game activity.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const days = parsePvmPeriodDays(
    new URL(request.url).searchParams.get('days'),
  );
  const now = new Date();
  const windowStart = new Date(now.getTime() - days * DAY_MS).toISOString();
  const historyStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_SHOWN - 1), 1),
  ).toISOString();
  const [allEvents, bounties, bridge] = await Promise.all([
    getEngagementEvents(historyStart),
    getBountyListings(),
    getRsnMemberBridge(),
  ]);
  const users = bridge.roster;
  // Audit rows outlive membership; only count events by people still on the roster so the
  // shares add up and the boards never list someone who has left.
  const rosterIds = new Set(users.map(user => user.discordId));
  const events = allEvents.filter(event => rosterIds.has(event.discordId));
  const inGame = await getInGameActivityByDiscordId(bridge);
  const lastEvents = lastEventAtByMember(events);
  const summary = summarizeEngagement(events, windowStart, now.toISOString());
  const activeInGame = new Set(
    users
      .filter(
        user =>
          (inGame.get(user.discordId)?.lastChangedAt ?? '') >= windowStart,
      )
      .map(user => user.discordId),
  );
  const reach = summarizeReach(
    events,
    windowStart,
    now.toISOString(),
    activeInGame,
  );
  const clanFlows = monthlyFlows(
    clanSystemActiveByMonth(events, MONTHS_SHOWN, now),
    users.length,
  );
  const inactivity = summarizeInactivity(
    users.map(user => ({
      discordId: user.discordId,
      joined: user.joined,
      lastClanEventAt: lastEvents.get(user.discordId) ?? null,
      lastInGameChangeAt: inGame.get(user.discordId)?.lastChangedAt ?? null,
      activeAlt: inGame.get(user.discordId)?.activeAlt ?? null,
      womRole: inGame.get(user.discordId)?.role ?? null,
    })),
    windowStart,
    now,
  );
  return json({
    days,
    rosterSize: users.length,
    names: Object.fromEntries(
      users.map(user => [user.discordId, user.nickname ?? null]),
    ) as Record<string, string | null>,
    bySystem: summary.bySystem,
    reach,
    activeInGameCount: activeInGame.size,
    clanFlows,
    activeMembers: summary.activeMembers,
    mostEngaged: summary.byMember.slice(0, MOST_ENGAGED_SHOWN),
    topBySystem: topMembersBySystem(
      events,
      windowStart,
      now.toISOString(),
      TOP_PER_SYSTEM,
    ),
    series: monthlyEngagementSeries(events, MONTHS_SHOWN, now),
    bounties,
    inactivity,
  });
}

/** Anchors the overview bars jump to. Sections carry scroll-mt-20 to clear the sticky nav. */
const SECTION_IDS = {
  bounties: 'bounties',
  systems: 'systems',
  pvm: 'pvm',
  notParticipating: 'not-participating',
  playing: 'playing',
  quiet: 'quiet',
  skilling: 'skilling',
  months: 'months',
  tenure: 'tenure',
} as const;

const sectionClass = 'scroll-mt-20';

/** The three questions the page answers, one tab each; the overview above stays for all. */
const TABS = [
  { key: 'systems', label: 'Clan systems' },
  { key: 'pvm', label: 'PvM' },
  { key: 'members', label: 'Members' },
] as const;

type InsightsTab = (typeof TABS)[number]['key'];

const DEFAULT_TAB: InsightsTab = 'systems';

const isInsightsTab = (value: string | null): value is InsightsTab =>
  TABS.some(option => option.key === value);

/** Which tab each section lives on, for the overview bars' click-through. */
const TAB_BY_SECTION: Record<string, InsightsTab> = {
  [SECTION_IDS.bounties]: 'systems',
  [SECTION_IDS.systems]: 'systems',
  [SECTION_IDS.pvm]: 'pvm',
  [SECTION_IDS.skilling]: 'pvm',
  [SECTION_IDS.months]: 'members',
  [SECTION_IDS.tenure]: 'members',
  [SECTION_IDS.notParticipating]: 'members',
  [SECTION_IDS.playing]: 'members',
  [SECTION_IDS.quiet]: 'members',
};

// Square, flat tabs: the active one gets the red fill the design system uses for selection.
const tabTriggerClass =
  'rounded-none px-3 text-base text-gray-400 hover:text-gray-100 data-[state=active]:bg-sanguine-red/10 data-[state=active]:text-gray-100 data-[state=active]:before:bg-sanguine-red';

const headerCellClass = 'text-osrs-orange';
const tableToggleClass = 'cursor-pointer select-none text-sm text-gray-500';
const numberCellClass = 'text-right tabular-nums';
const numberHeaderClass = `${headerCellClass} text-right`;

interface ICountProps {
  value: number;
}

const Count = ({ value }: ICountProps) => (
  <span className={value === 0 ? 'text-gray-600' : 'text-gray-100'}>
    {value.toLocaleString()}
  </span>
);

interface IFigureProps {
  label: string;
  value: ReactNode;
}

/** "label value" pair for the figure strips: gray label, white number. */
const Figure = ({ label, value }: IFigureProps) => (
  <span className="whitespace-nowrap text-gray-400">
    {label} <span className="text-gray-100">{value}</span>
  </span>
);

interface INoteProps {
  children: ReactNode;
}

/** One line under a heading saying what the numbers are. */
const Note = ({ children }: INoteProps) => (
  <Text as="p" size="2" className="mb-2 mt-1 text-gray-500">
    {children}
  </Text>
);

interface IGlossaryProps {
  rosterSize: number;
  days: number;
}

/**
 * The terms every tab leans on, defined once under the title. Section-specific ones (reach,
 * repeat, lift) are explained where they appear.
 */
const Glossary = ({ rosterSize, days }: IGlossaryProps) => {
  const floor = pvmFloorForDays(days);
  const terms: { term: string; definition: string }[] = [
    {
      term: 'Roster',
      definition: `Everyone the bot currently tracks as a clan member: the same ${rosterSize.toLocaleString()} people the members page lists. Leavers and Discord guests are not counted. Every percentage is a share of the roster unless it says otherwise.`,
    },
    {
      term: 'Period',
      definition: `The last ${days} days, from the selector. Every figure uses it unless it names another span.`,
    },
    {
      term: 'Clan systems',
      definition:
        'The six things the bot tracks outside the game: drops posted, competition placings, Sanguine Slayer, bounties, raid submissions, and personal bests.',
    },
    {
      term: 'Action',
      definition:
        'One use of a clan system: a drop posted, a placing, a Slayer spin or completion, a bounty won, or taking part in an approved raid or PB. Never points.',
    },
    {
      term: 'Engaged',
      definition: 'Did at least one action in the period.',
    },
    {
      term: 'Idle',
      definition:
        'Did no action in the period. Split below by what Wise Old Man saw them do in-game.',
    },
    {
      term: 'In-game active',
      definition:
        'Wise Old Man saw any of their accounts change in the period. Registered alts count for their owner.',
    },
    {
      term: 'Playing, not participating',
      definition:
        'Idle, but in-game active. The people an event should be pulling in.',
    },
    {
      term: 'Gone quiet',
      definition: 'Idle and not in-game active either.',
    },
    {
      term: 'Not on WOM',
      definition:
        'No account of theirs is in the Wise Old Man group, so nothing in-game can be seen. Usually a nickname or WOM entry to fix.',
    },
    {
      term: 'EHB and EHP',
      definition:
        'Efficient hours bossed and efficient hours played, per Wise Old Man: PvM effort and skilling effort in comparable hours.',
    },
    {
      term: 'PvM floor',
      definition: `${floor} EHB over this period (0.05 a day). At or above it counts as PvMing; below it, with any gain at all, counts as skilling.`,
    },
  ];
  return (
    <details className="mt-3" open>
      <summary className="cursor-pointer select-none text-sm text-gray-400">
        Terms used on this page
      </summary>
      <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {terms.map(({ term, definition }) => (
          <div key={term} className="text-sm">
            <dt className="inline text-osrs-orange">{term}.</dt>{' '}
            <dd className="inline text-gray-500">{definition}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
};

interface IReadingProps {
  children: ReactNode;
}

/** One line under a stat saying what the number is and which way is good. */
const Reading = ({ children }: IReadingProps) => (
  <Text as="p" size="2" className="mt-2 text-gray-500">
    <span className="text-osrs-orange">Reading it:</span> {children}
  </Text>
);

const NoData = () => (
  <Text as="p" size="2" className="py-4 text-gray-600">
    Nothing interesting happens.
  </Text>
);

interface IRetryProps {
  message: string;
  onRetry: () => void;
  loading: boolean;
}

/** In-place failure for a WOM-backed section or row: what went wrong and a way to try again. */
const Retry = ({ message, onRetry, loading }: IRetryProps) => (
  <Flex align="center" gap="3">
    <Text size="2" className="text-gray-500">
      {message}
    </Text>
    <Button type="button" size="sm" loading={loading} onClick={onRetry}>
      Retry
    </Button>
  </Flex>
);

const formatGain = (metric: string, value: number) =>
  metric === 'ehb'
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : Math.round(value).toLocaleString();

const formatDate = (iso: string) => dayjs(iso).format('MMM D, YYYY');

interface IAltNoteProps {
  alt: string | null;
}

/** "on AltName" after an in-game figure when the latest change was on a registered alt. */
const AltNote = ({ alt }: IAltNoteProps) =>
  alt ? (
    <Text size="1" className="ml-1 hidden text-gray-500 sm:inline">
      on {alt}
    </Text>
  ) : null;

/** Days since, as "3d" or "today", or a dimmed "none" when there is nothing on record. */
const daysAgo = (days: number | null) =>
  days === null ? (
    <span className="text-gray-600">none</span>
  ) : days === 0 ? (
    'today'
  ) : (
    `${days}d`
  );

// Phones get Drops and Raids beside the month; tablets add the rest.
const monthColumnClass = (system: EngagementSystem) =>
  system === 'drops'
    ? ''
    : system === 'raids'
      ? 'hidden sm:table-cell'
      : 'hidden md:table-cell';

const bountyStatusLabel = (bounty: IBountyListing) => {
  switch (bounty.status) {
    case BOUNTY_STATUS.OPEN:
      return 'open';
    case BOUNTY_STATUS.CLAIMED:
      return 'claimed';
    case BOUNTY_STATUS.EXPIRED:
      return 'expired';
    default:
      return 'cancelled';
  }
};

interface IBountyRowProps {
  bounty: IBountyListing;
  autoLoad: boolean;
  /** Hands a finished scorecard to the page so the dumbbell and the aggregate can use it. */
  onMeasured: (bountyId: string, result: IBountyScorecardResult) => void;
}

function BountyRow({ bounty, autoLoad, onMeasured }: IBountyRowProps) {
  const fetcher = useFetcher<typeof bountyScorecardLoader>();
  const href = `/admin/insights/bounty/${bounty.id}`;
  const loading = fetcher.state !== 'idle';
  const result = fetcher.data?.ok ? fetcher.data.result : undefined;
  const failure = fetcher.data?.ok === false ? fetcher.data.error : null;

  useEffect(() => {
    if (autoLoad && fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(href);
    }
  }, [autoLoad, fetcher, href]);

  useEffect(() => {
    if (result) {
      onMeasured(bounty.id, result);
    }
  }, [bounty.id, onMeasured, result]);

  const measuredCells = result ? (
    <>
      <Table.Cell className={numberCellClass}>
        <Count value={result.scorecard.participants} />
      </Table.Cell>
      <Table.Cell className={`${numberCellClass} hidden sm:table-cell`}>
        <Count value={result.scorecard.baselineParticipants} />
      </Table.Cell>
      <Table.Cell className={numberCellClass}>
        <span
          className={
            result.scorecard.lift > 0 ? 'text-gray-100' : 'text-gray-600'
          }
        >
          {result.scorecard.lift > 0 ? '+' : ''}
          {result.scorecard.lift.toLocaleString()}
        </span>
        {result.scorecard.liftPercent !== null && (
          <Text size="1" className="ml-1 hidden text-gray-500 sm:inline">
            {result.scorecard.liftPercent > 0 ? '+' : ''}
            {result.scorecard.liftPercent}%
          </Text>
        )}
        {result.scorecard.adjustedLiftPercent !== null && (
          <Text
            size="1"
            className="ml-1 hidden text-gray-500 md:inline"
            title="Adjusted for the clan's overall PvM movement between the two windows"
          >
            adj {result.scorecard.adjustedLiftPercent > 0 ? '+' : ''}
            {result.scorecard.adjustedLiftPercent}%
          </Text>
        )}
        {!result.window.settled && (
          <Text size="1" className="ml-1 text-gray-500" title="Still settling">
            ~
          </Text>
        )}
      </Table.Cell>
      <Table.Cell className={`${numberCellClass} hidden md:table-cell`}>
        {result.scorecard.hoursOpen === null ? (
          <span className="text-gray-600">open</span>
        ) : (
          <Count value={result.scorecard.hoursOpen} />
        )}
      </Table.Cell>
    </>
  ) : (
    <>
      <Table.Cell className="text-right">
        <Button
          type="button"
          size="sm"
          loading={loading}
          title={failure ?? undefined}
          onClick={() => fetcher.load(href)}
        >
          {failure ? 'Retry' : 'Measure'}
        </Button>
      </Table.Cell>
      <Table.Cell className="hidden sm:table-cell" />
      <Table.Cell />
      <Table.Cell className="hidden md:table-cell" />
    </>
  );

  return (
    <Table.Row className={zebraStripeClass}>
      <Table.Cell>
        <Text size="2" className="text-gray-100">
          {bounty.bossDisplayName}
        </Text>{' '}
        <Text size="2" className="ml-1 text-gray-500">
          <span className="whitespace-nowrap">
            {formatDate(bounty.postedAt)}
          </span>
          {' · '}
          <span className="whitespace-nowrap">{bountyStatusLabel(bounty)}</span>
        </Text>
        {result && result.scorecard.topParticipants.length > 0 && (
          <Text as="p" size="1" className="hidden text-gray-500 md:block">
            {result.scorecard.topParticipants
              .map(row => `${row.displayName} ${row.gained}`)
              .join(' · ')}
          </Text>
        )}
      </Table.Cell>
      <Table.Cell className={`${numberCellClass} hidden sm:table-cell`}>
        <Count value={bounty.claimCount} />
        <Text size="1" className="ml-1 text-gray-500">
          of {bounty.maxWinners}
        </Text>
      </Table.Cell>
      {measuredCells}
    </Table.Row>
  );
}

interface IPvmActivitySectionProps {
  days: number;
}

function PvmActivitySection({ days }: IPvmActivitySectionProps) {
  const fetcher = useFetcher<typeof pvmActivityLoader>();
  const [metric, setMetric] = useState(PVM_METRICS[0].metric);
  const href = `/admin/insights/pvm?metric=${metric}&days=${days}`;
  const label =
    PVM_METRICS.find(option => option.metric === metric)?.label ?? metric;

  useEffect(() => {
    fetcher.load(href);
    // The fetcher object changes identity on every state change; only the target matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  const result = fetcher.data?.ok ? fetcher.data : undefined;
  const failure = fetcher.data?.ok === false ? fetcher.data.error : null;
  const loading = fetcher.state !== 'idle';

  return (
    <Box mt="8" id={SECTION_IDS.pvm} className={sectionClass}>
      <SectionHeading
        title="PvM activity"
        summary={
          <Select.Root value={metric} onValueChange={setMetric}>
            <Select.Trigger color="gray" />
            <Select.Content position="popper">
              {PVM_METRICS.map(option => (
                <Select.Item key={option.metric} value={option.metric}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        }
      />
      <Note>
        Wise Old Man gains on {label.toLowerCase()} over the last {days} days.
        Members whose number moved at all count as active.
      </Note>
      {failure && !result ? (
        <Box py="2">
          <Retry
            message={failure}
            loading={loading}
            onRetry={() => fetcher.load(href)}
          />
        </Box>
      ) : !result ? (
        <Text as="p" size="2" className="py-4 text-gray-500">
          {loading ? 'Reading Wise Old Man…' : 'Pick a metric.'}
        </Text>
      ) : (
        <Box className={loading ? 'opacity-60' : ''}>
          <Flex gap="4" wrap="wrap" mb="2">
            <Figure
              label="Active"
              value={result.activity.activeMembers.toLocaleString()}
            />
            <Figure
              label="Total gained"
              value={formatGain(result.metric, result.activity.totalGained)}
            />
          </Flex>
          <Reading>
            Active is how many members moved this metric at all. Total gained is
            the clan&apos;s combined gain: hours for EHB, kills for a raid or
            boss. The bars rank who gained most; a long top bar with a short
            tail means a few members carry the number.
          </Reading>
          {result.activity.top.length === 0 ? (
            <NoData />
          ) : (
            <>
              <HorizontalBars
                rows={result.activity.top.map(row => ({
                  label: row.displayName,
                  value: row.gained,
                }))}
                formatValue={value => formatGain(result.metric, value)}
                labelWidth={150}
              />
              <details className="mt-2">
                <summary className={tableToggleClass}>Table view</summary>
                <Table.Root size="2">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell className={numberHeaderClass}>
                        #
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className={headerCellClass}>
                        Player
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className={numberHeaderClass}>
                        Gained
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {result.activity.top.map((row, index) => (
                      <Table.Row
                        key={row.displayName}
                        className={zebraStripeClass}
                      >
                        <Table.Cell
                          className={`${numberCellClass} text-gray-500`}
                        >
                          {index + 1}
                        </Table.Cell>
                        <Table.Cell>
                          {row.discordId ? (
                            <Link
                              to={`/users/${row.discordId}`}
                              className={proseLinkClass}
                            >
                              {row.displayName}
                            </Link>
                          ) : (
                            <a
                              href={`https://wiseoldman.net/players/${encodeURIComponent(row.displayName)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 hover:text-white"
                            >
                              {row.displayName}
                            </a>
                          )}
                        </Table.Cell>
                        <Table.Cell
                          className={`${numberCellClass} text-gray-100`}
                        >
                          {formatGain(result.metric, row.gained)}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </details>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

type SkillingFetcher = ReturnType<typeof useFetcher<typeof skillingLoader>>;

/** The page owns one skilling read; the composition bar and the list both draw from it. */
const useSkillingRead = (days: number) => {
  const fetcher: SkillingFetcher = useFetcher<typeof skillingLoader>();
  const href = `/admin/insights/skilling?days=${days}`;

  useEffect(() => {
    fetcher.load(href);
    // The fetcher object changes identity on every state change; only the target matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  return {
    result: fetcher.data?.ok ? fetcher.data : undefined,
    failure: fetcher.data?.ok === false ? fetcher.data.error : null,
    loading: fetcher.state !== 'idle',
    retry: () => fetcher.load(href),
  };
};

type SkillingRead = ReturnType<typeof useSkillingRead>;

/** One read of who played in each of the last months, for the activity-by-month charts. */
const useMonthsRead = () => {
  const fetcher = useFetcher<typeof monthsLoader>();
  const href = '/admin/insights/months';

  useEffect(() => {
    fetcher.load(href);
    // The fetcher object changes identity on every state change; only the target matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  return {
    result: fetcher.data?.ok ? fetcher.data : undefined,
    failure: fetcher.data?.ok === false ? fetcher.data.error : null,
    loading: fetcher.state !== 'idle',
    retry: () => fetcher.load(href),
  };
};

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

interface IInGameSplitBarProps {
  skilling: SkillingRead;
  rosterSize: number;
  onSelect: (targetId: string) => void;
}

/** PvMing / skilling / no gains, as the in-game twin of the clan-systems bar above it. */
function InGameSplitBar({
  skilling,
  rosterSize,
  onSelect,
}: IInGameSplitBarProps) {
  const { result, failure, loading, retry } = skilling;
  const percent = (part: number) =>
    rosterSize === 0 ? '0%' : `${Math.round((part / rosterSize) * 100)}%`;
  return !result ? (
    <Box>
      <Text as="p" size="2" className="mb-1 text-gray-500">
        In-game, per Wise Old Man
      </Text>
      {failure ? (
        <Retry message={failure} loading={loading} onRetry={retry} />
      ) : (
        <Text as="p" size="2" className="text-gray-600">
          Reading Wise Old Man…
        </Text>
      )}
    </Box>
  ) : (
    <Box className={loading ? 'opacity-60' : ''}>
      <CompositionBar
        title="In-game, per Wise Old Man"
        segments={[
          {
            key: 'pvming',
            label: 'PvMing',
            value: result.split.pvming,
            targetId: SECTION_IDS.pvm,
          },
          {
            key: 'skilling',
            label: 'Skilling',
            value: result.split.skilling,
            targetId: SECTION_IDS.skilling,
          },
          {
            key: 'nogains',
            label: 'No gains',
            value: result.split.noGains,
            targetId: SECTION_IDS.notParticipating,
          },
        ]}
        formatValue={value => `${value.toLocaleString()} (${percent(value)})`}
        onSelect={onSelect}
      />
      <Reading>
        Percentages are of the roster. PvMing gained at least the PvM floor in
        efficient hours bossed this period; skilling gained something but less
        than that; no gains moved nothing. More red means more of the clan is
        doing PvM, which is what a PvM clan wants.
      </Reading>
    </Box>
  );
}

interface ISkillingOnlySectionProps {
  skilling: SkillingRead;
}

/** Members online this period who gained almost no EHB, with the EHP that shows what they did. */
function SkillingOnlySection({ skilling }: ISkillingOnlySectionProps) {
  const { result, failure, loading, retry } = skilling;
  const hours = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

  return (
    <>
      <SubsectionHeading
        title="Skilling only"
        hint={
          result
            ? `active in-game, under ${hours(result.floor)} EHB gained this period`
            : 'active in-game, almost no EHB gained this period'
        }
        summary={
          result ? (
            <Text size="2" className="text-gray-400">
              {result.rows.length}
            </Text>
          ) : undefined
        }
      />
      {failure && !result ? (
        <Box py="2">
          <Retry message={failure} loading={loading} onRetry={retry} />
        </Box>
      ) : !result ? (
        <Text as="p" size="2" className="py-2 text-gray-500">
          {loading ? 'Reading Wise Old Man…' : ''}
        </Text>
      ) : result.rows.length === 0 ? (
        <Text as="p" size="2" className="py-2 text-gray-600">
          Nobody.
        </Text>
      ) : (
        <Table.Root size="2" className={loading ? 'opacity-60' : ''}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell className={headerCellClass}>
                Member
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell
                className={`${headerCellClass} hidden sm:table-cell`}
              >
                Rank
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell
                className={`${numberHeaderClass} hidden md:table-cell`}
              >
                <span className="whitespace-nowrap">In-game</span>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className={numberHeaderClass}>
                EHP
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className={numberHeaderClass}>
                EHB
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {result.rows.map(row => (
              <Table.Row key={row.discordId} className={zebraStripeClass}>
                <Table.Cell>
                  <Link
                    to={`/users/${row.discordId}`}
                    className={proseLinkClass}
                  >
                    {row.name ?? `Unknown (${row.discordId})`}
                  </Link>
                </Table.Cell>
                <Table.Cell className="hidden text-gray-400 sm:table-cell">
                  {row.womRole ? rankLabel(row.womRole) : ''}
                </Table.Cell>
                <Table.Cell
                  className={`${numberCellClass} hidden text-gray-300 md:table-cell`}
                >
                  {daysAgo(row.daysSinceInGameChange)}
                  <AltNote alt={row.activeAlt} />
                </Table.Cell>
                <Table.Cell className={`${numberCellClass} text-gray-100`}>
                  {hours(row.ehpGained)}
                </Table.Cell>
                <Table.Cell className={numberCellClass}>
                  <span
                    className={
                      row.ehbGained === 0 ? 'text-gray-600' : 'text-gray-300'
                    }
                  >
                    {hours(row.ehbGained)}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </>
  );
}

interface IInactiveTableProps {
  rows: IInactiveMember[];
  memberName: (discordId: string) => string;
  /** Whether the in-game column applies (it doesn't for members missing from WOM). */
  inGame: boolean;
}

function InactiveTable({ rows, memberName, inGame }: IInactiveTableProps) {
  return rows.length === 0 ? (
    <Text as="p" size="2" className="py-2 text-gray-600">
      Nobody.
    </Text>
  ) : (
    <Table.Root size="2">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell className={headerCellClass}>
            Member
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            className={`${headerCellClass} hidden sm:table-cell`}
          >
            Rank
          </Table.ColumnHeaderCell>
          {inGame && (
            <Table.ColumnHeaderCell
              className={`${numberHeaderClass} whitespace-nowrap`}
            >
              <span className="sm:hidden">Game</span>
              <span className="hidden sm:inline">In-game</span>
            </Table.ColumnHeaderCell>
          )}
          <Table.ColumnHeaderCell className={numberHeaderClass}>
            <span className="sm:hidden">Clan</span>
            <span className="hidden sm:inline">Clan activity</span>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            className={`${numberHeaderClass} hidden md:table-cell`}
          >
            Joined
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map(row => (
          <Table.Row key={row.discordId} className={zebraStripeClass}>
            <Table.Cell>
              <Link to={`/users/${row.discordId}`} className={proseLinkClass}>
                {memberName(row.discordId)}
              </Link>
            </Table.Cell>
            <Table.Cell className="hidden text-gray-400 sm:table-cell">
              {row.womRole ? rankLabel(row.womRole) : ''}
            </Table.Cell>
            {inGame && (
              <Table.Cell className={`${numberCellClass} text-gray-300`}>
                {daysAgo(row.daysSinceInGameChange)}
                <AltNote alt={row.activeAlt} />
              </Table.Cell>
            )}
            <Table.Cell className={`${numberCellClass} text-gray-300`}>
              {daysAgo(row.daysSinceClanEvent)}
            </Table.Cell>
            <Table.Cell
              className={`${numberCellClass} hidden text-gray-500 md:table-cell`}
            >
              {formatDate(row.joined)}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

interface IActivityByMonthSectionProps {
  clanFlows: IMonthlyFlow[];
}

/** Lives on the Members tab so its WOM reads fire only when someone opens it. */
function ActivityByMonthSection({ clanFlows }: IActivityByMonthSectionProps) {
  const months = useMonthsRead();
  return (
    <Box id={SECTION_IDS.months} className={sectionClass}>
      <SectionHeading
        title="Activity by month"
        summary={
          <Text size="2" className="text-gray-400">
            last {MONTHS_SHOWN} months
          </Text>
        }
      />
      <Note>
        Active share is the percent of the roster that played (any xp gained,
        per Wise Old Man) or touched a clan system in the month. Churn is people
        active the month before but not this one; reactivation is the reverse.
        The current month is partial.
      </Note>
      <Reading>
        A higher played share is good. In the flow bars, a blue bar taller than
        the amber one means more people came back than went quiet, so the active
        set grew; the reverse means it shrank even if the share line looks flat.
      </Reading>
      {months.failure && !months.result && (
        <Box py="2">
          <Retry
            message={months.failure}
            loading={months.loading}
            onRetry={months.retry}
          />
        </Box>
      )}
      <SmallMultiples
        series={[
          ...(months.result
            ? [
                {
                  key: 'ingame',
                  title: 'Played, share of roster',
                  points: months.result.months.map(row => ({
                    label: row.label.slice(0, 3),
                    value: row.activeShare ?? 0,
                  })),
                },
              ]
            : []),
          {
            key: 'systems',
            title: 'Touched a clan system, share of roster',
            points: clanFlows.map(row => ({
              label: row.label.slice(0, 3),
              value: row.activeShare ?? 0,
            })),
          },
        ]}
        max={100}
        formatValue={value => `${value}%`}
      />
      {!months.result && !months.failure && (
        <Text as="p" size="2" className="mt-1 text-gray-500">
          Reading Wise Old Man for the in-game months…
        </Text>
      )}
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
        {months.result && (
          <Box>
            <Text as="p" size="2" className="mb-1 text-gray-300">
              In-game, month over month
            </Text>
            <DivergingBars
              points={months.result.months.map(row => ({
                label: row.label.slice(0, 3),
                up: row.reactivated,
                down: row.churned,
              }))}
              upLabel="Came back"
              downLabel="Went quiet"
            />
          </Box>
        )}
        <Box>
          <Text as="p" size="2" className="mb-1 text-gray-300">
            Clan systems, month over month
          </Text>
          <DivergingBars
            points={clanFlows.map(row => ({
              label: row.label.slice(0, 3),
              up: row.reactivated,
              down: row.churned,
            }))}
            upLabel="Came back"
            downLabel="Went quiet"
          />
        </Box>
      </div>
    </Box>
  );
}

export default function AdminInsights() {
  const {
    days,
    rosterSize,
    names,
    bySystem,
    reach,
    activeInGameCount,
    clanFlows,
    activeMembers,
    mostEngaged,
    topBySystem,
    series,
    bounties,
    inactivity,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const skilling = useSkillingRead(days);
  const tabParam = searchParams.get('tab');
  const tab: InsightsTab = isInsightsTab(tabParam) ? tabParam : DEFAULT_TAB;
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const selectTab = (next: InsightsTab) =>
    setSearchParams(
      { ...Object.fromEntries(searchParams), tab: next },
      { preventScrollReset: true },
    );
  // Switch to the section's tab first; the scroll happens once that tab has rendered.
  const goTo = (sectionId: string) => {
    const target = TAB_BY_SECTION[sectionId] ?? DEFAULT_TAB;
    setPendingSection(sectionId);
    if (target !== tab) {
      selectTab(target);
    }
  };
  useEffect(() => {
    if (pendingSection && TAB_BY_SECTION[pendingSection] === tab) {
      // Two frames later: after the tab's content has laid out and after the router's own
      // scroll handling for the navigation, which would otherwise cancel the jump.
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => jumpToSection(pendingSection)),
      );
      setPendingSection(null);
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [pendingSection, tab]);
  const [measured, setMeasured] = useState<
    Record<string, IBountyScorecardResult>
  >({});
  const onMeasured = useCallback(
    (bountyId: string, result: IBountyScorecardResult) =>
      setMeasured(previous =>
        previous[bountyId] === result
          ? previous
          : { ...previous, [bountyId]: result },
      ),
    [],
  );
  const measuredBounties = bounties.flatMap(bounty =>
    measured[bounty.id] ? [{ bounty, result: measured[bounty.id] }] : [],
  );
  const liftSample = measuredBounties.filter(
    ({ result }) => result.scorecard.liftPercent !== null,
  );
  const medianLift = Math.round(
    median(liftSample.map(({ result }) => result.scorecard.liftPercent ?? 0)),
  );
  const adjustedSample = liftSample.filter(
    ({ result }) => result.scorecard.adjustedLiftPercent !== null,
  );
  const medianAdjusted = Math.round(
    median(
      adjustedSample.map(
        ({ result }) => result.scorecard.adjustedLiftPercent ?? 0,
      ),
    ),
  );
  const reachOrder = [...reach].sort(
    (a, b) => (b.reach ?? -1) - (a.reach ?? -1),
  );

  const memberName = (discordId: string) =>
    names[discordId] ?? `Unknown (${discordId})`;
  const percent = (part: number) =>
    rosterSize === 0 ? '0%' : `${Math.round((part / rosterSize) * 100)}%`;
  const idleCount =
    inactivity.playingNotParticipating.length +
    inactivity.goneQuiet.length +
    inactivity.notOnWom.length;

  return (
    <Box>
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="7" className="font-normal text-gray-100">
          Clan insights
        </Heading>
        <Select.Root
          value={String(days)}
          onValueChange={value =>
            setSearchParams(
              { ...Object.fromEntries(searchParams), days: value },
              { preventScrollReset: true },
            )
          }
        >
          <Select.Trigger color="gray" />
          <Select.Content position="popper">
            {PVM_PERIOD_DAYS.map(option => (
              <Select.Item key={option} value={String(option)}>
                Last {option} days
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>
      <Glossary rosterSize={rosterSize} days={days} />
      <Flex gap="4" wrap="wrap" mt="3" mb="3">
        <Figure label="Roster" value={rosterSize.toLocaleString()} />
        <Figure
          label="Active in clan systems"
          value={`${activeMembers.toLocaleString()} (${percent(activeMembers)})`}
        />
        <Figure
          label="Idle"
          value={`${idleCount.toLocaleString()} (${percent(idleCount)})`}
        />
      </Flex>
      <Reading>
        Active in clan systems is how many of the roster did anything in a clan
        system this period; higher is better. Idle is everyone else.
      </Reading>
      <Flex direction="column" gap="4" mt="4" mb="6">
        <CompositionBar
          title="Clan systems"
          segments={[
            {
              key: 'active',
              label: 'Engaged',
              value: activeMembers,
              targetId: SECTION_IDS.systems,
            },
            {
              key: 'playing',
              label: 'Playing, not participating',
              value: inactivity.playingNotParticipating.length,
              targetId: SECTION_IDS.playing,
            },
            {
              key: 'quiet',
              label: 'Gone quiet',
              value: inactivity.goneQuiet.length,
              targetId: SECTION_IDS.quiet,
            },
          ]}
          formatValue={value => `${value.toLocaleString()} (${percent(value)})`}
          onSelect={goTo}
        />
        <Reading>
          Percentages are of the roster. Engaged did something in a clan system
          this period. Playing, not participating were seen in-game but touched
          nothing: the people an event should be pulling in. Gone quiet were
          seen in neither. A bigger red share is the goal; the blue share is the
          opportunity.
        </Reading>
        <InGameSplitBar
          skilling={skilling}
          rosterSize={rosterSize}
          onSelect={goTo}
        />
      </Flex>

      <Tabs.Root
        value={tab}
        onValueChange={value => selectTab(value as InsightsTab)}
      >
        <Tabs.List className="mb-4 border-b border-gray-700 shadow-none">
          {TABS.map(option => (
            <Tabs.Trigger
              key={option.key}
              value={option.key}
              className={tabTriggerClass}
            >
              {option.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="systems">
          <Box id={SECTION_IDS.bounties} className={sectionClass}>
            <SectionHeading
              title="Bounty lift"
              summary={
                <Text size="2" className="text-gray-400">
                  {bounties.length} posted
                </Text>
              }
            />
            <Note>
              Did it: members whose WOM kill count for the boss moved between
              the daily update before the bounty opened and the one after it
              closed. Before: the same span of time immediately prior. Lift: the
              difference. A tilde marks a window still waiting on the next
              update.
            </Note>
            {measuredBounties.length > 0 && (
              <Box mb="4">
                <Flex gap="4" wrap="wrap" mb="2">
                  <Figure label="Measured" value={measuredBounties.length} />
                  {liftSample.length > 0 && (
                    <Figure label="Median lift" value={signed(medianLift)} />
                  )}
                  {adjustedSample.length > 0 && (
                    <Figure
                      label="Median lift, PvM-adjusted"
                      value={signed(medianAdjusted)}
                    />
                  )}
                </Flex>
                <Reading>
                  Lift is how many more members killed the boss during the
                  bounty than in the same span before it, as a percent of the
                  before count. Positive means the bounty pulled people in; the
                  adjusted figure subtracts whatever all PvM did at the same
                  time, so it is the one to trust. Medians ignore one freak
                  bounty either way.
                </Reading>
                <DumbbellChart
                  rows={measuredBounties.map(({ bounty, result }) => ({
                    key: bounty.id,
                    label: bounty.bossDisplayName,
                    sublabel: dayjs(bounty.postedAt).format('MMM D'),
                    before: result.scorecard.baselineParticipants,
                    after: result.scorecard.participants,
                  }))}
                  beforeLabel="Members killing it before"
                  afterLabel="During the bounty"
                />
                <Text as="p" size="2" className="mt-2 text-gray-500">
                  Single bounties on small counts are noise; read the medians,
                  and the adjusted one removes whatever all PvM did between the
                  two windows.
                </Text>
              </Box>
            )}
            {bounties.length === 0 ? (
              <NoData />
            ) : (
              <Table.Root size="2">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell className={headerCellClass}>
                      Bounty
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      className={`${numberHeaderClass} hidden sm:table-cell`}
                    >
                      Claims
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={numberHeaderClass}>
                      Did it
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      className={`${numberHeaderClass} hidden sm:table-cell`}
                    >
                      Before
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={numberHeaderClass}>
                      Lift
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      className={`${numberHeaderClass} hidden md:table-cell`}
                    >
                      Hours
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {bounties.map((bounty, index) => (
                    <BountyRow
                      key={bounty.id}
                      bounty={bounty}
                      autoLoad={index < AUTO_MEASURED_BOUNTIES}
                      onMeasured={onMeasured}
                    />
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Box>

          <Box mt="8" id={SECTION_IDS.systems} className={sectionClass}>
            <SectionHeading title="Systems engagement" />
            <Note>
              Counts are actions, never points: one per drop posted, competition
              placing, Slayer spin or completion, bounty won, and per
              participant of each approved raid or PB, in the last {days} days.
              A system that launched inside the period shows how many days it
              was live; actions per week in the table view is over live days
              only.
            </Note>
            {activeMembers === 0 ? (
              <NoData />
            ) : (
              <Flex direction="column" gap="4">
                <Box>
                  <SubsectionHeading
                    title="Reach among active players"
                    hint={`of the ${activeInGameCount} members WOM saw play this period; drops are auto-posted, so they measure playing, not engaging`}
                  />
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
                    <Box>
                      <Text as="p" size="2" className="mb-1 text-gray-500">
                        Used the system, as a share of active players. Higher
                        means more of the people actually playing chose to use
                        it.
                      </Text>
                      <HorizontalBars
                        rows={reachOrder.map(row => ({
                          label: ENGAGEMENT_SYSTEM_LABELS[row.system],
                          value: row.reach ?? 0,
                          annotation: row.passive ? 'passive' : '',
                        }))}
                        max={100}
                        formatValue={value => `${value}%`}
                      />
                    </Box>
                    <Box>
                      <Text as="p" size="2" className="mb-1 text-gray-500">
                        Came back: share of last period&apos;s users who used it
                        again. High means it is sticking; low after a launch
                        means it was a novelty.
                      </Text>
                      <HorizontalBars
                        rows={reachOrder.map(row => ({
                          label: ENGAGEMENT_SYSTEM_LABELS[row.system],
                          value: row.repeat ?? 0,
                          annotation:
                            row.repeat === null
                              ? 'no users before'
                              : `of ${row.previousUsers}`,
                        }))}
                        max={100}
                        formatValue={value => `${value}%`}
                      />
                    </Box>
                  </div>
                  <details className="mt-2">
                    <summary className={tableToggleClass}>Table view</summary>
                    <Table.Root size="2">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell className={headerCellClass}>
                            System
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className={numberHeaderClass}>
                            Members
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className={numberHeaderClass}>
                            Actions
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className={numberHeaderClass}>
                            Live days
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell className={numberHeaderClass}>
                            Actions/wk
                          </Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {bySystem.map(row => (
                          <Table.Row
                            key={row.system}
                            className={zebraStripeClass}
                          >
                            <Table.Cell className="text-gray-300">
                              {ENGAGEMENT_SYSTEM_LABELS[row.system]}
                            </Table.Cell>
                            <Table.Cell className={numberCellClass}>
                              <Count value={row.members} />
                              {row.members > 0 && (
                                <Text size="1" className="ml-1 text-gray-500">
                                  {percent(row.members)}
                                </Text>
                              )}
                            </Table.Cell>
                            <Table.Cell className={numberCellClass}>
                              <Count value={row.events} />
                            </Table.Cell>
                            <Table.Cell className={numberCellClass}>
                              <Count value={row.liveDays} />
                            </Table.Cell>
                            <Table.Cell className={numberCellClass}>
                              <Count value={row.actionsPerWeek} />
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </details>
                </Box>
                <Box>
                  <SubsectionHeading
                    title="Top by system"
                    hint={`the ${TOP_PER_SYSTEM} busiest members of each this period; the number is that member's actions, in the unit beside each title`}
                  />
                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ENGAGEMENT_SYSTEMS.map(system => (
                      <Box key={system}>
                        <Text
                          as="p"
                          size="2"
                          className="border-b border-gray-800 pb-1 text-gray-300"
                        >
                          {ENGAGEMENT_SYSTEM_LABELS[system]}{' '}
                          <span className="text-gray-500">
                            {ENGAGEMENT_SYSTEM_UNITS[system]}
                          </span>
                        </Text>
                        {topBySystem[system].length === 0 ? (
                          <Text as="p" size="2" className="py-1 text-gray-600">
                            Nothing interesting happens.
                          </Text>
                        ) : (
                          <ol className="mt-1">
                            {topBySystem[system].map((leader, index) => (
                              <li
                                key={leader.discordId}
                                className={`flex items-baseline justify-between gap-3 py-0.5 ${zebraStripeClass}`}
                              >
                                <Text size="2">
                                  <span className="mr-2 text-gray-500">
                                    {index + 1}
                                  </span>
                                  <Link
                                    to={`/users/${leader.discordId}`}
                                    className={proseLinkClass}
                                  >
                                    {memberName(leader.discordId)}
                                  </Link>
                                </Text>
                                <Text
                                  size="2"
                                  className="tabular-nums text-gray-100"
                                >
                                  {leader.events.toLocaleString()}
                                </Text>
                              </li>
                            ))}
                          </ol>
                        )}
                      </Box>
                    ))}
                  </div>
                </Box>
                <Box>
                  <SubsectionHeading
                    title="Most engaged"
                    hint={`top ${Math.min(mostEngaged.length, MOST_ENGAGED_SHOWN)}, by systems touched, then actions. More systems means broader engagement, not just more volume`}
                  />
                  <Table.Root size="2">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell className={numberHeaderClass}>
                          #
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell className={headerCellClass}>
                          Member
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell
                          className={`${headerCellClass} hidden sm:table-cell`}
                        >
                          Systems
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell className={numberHeaderClass}>
                          Actions
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {mostEngaged.map((row, index) => (
                        <Table.Row
                          key={row.discordId}
                          className={zebraStripeClass}
                        >
                          <Table.Cell
                            className={`${numberCellClass} text-gray-500`}
                          >
                            {index + 1}
                          </Table.Cell>
                          <Table.Cell>
                            <Link
                              to={`/users/${row.discordId}`}
                              className={proseLinkClass}
                            >
                              {memberName(row.discordId)}
                            </Link>
                            <Text
                              size="1"
                              className="ml-1 text-gray-500 sm:hidden"
                            >
                              {row.systems.length} of{' '}
                              {ENGAGEMENT_SYSTEMS.length}
                            </Text>
                          </Table.Cell>
                          <Table.Cell className="hidden text-gray-400 sm:table-cell">
                            {row.systems
                              .map(
                                (system: EngagementSystem) =>
                                  ENGAGEMENT_SYSTEM_SHORT_LABELS[system],
                              )
                              .join(', ')}
                          </Table.Cell>
                          <Table.Cell className={numberCellClass}>
                            <Count value={row.events} />
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Flex>
            )}

            <Box mt="4">
              <SubsectionHeading
                title="Month by month"
                hint="distinct members per system on a shared scale; the number is this month so far. A rising line means the system is reaching more different people, not the same people more often"
              />
              <SmallMultiples
                series={ENGAGEMENT_SYSTEMS.map(system => ({
                  key: system,
                  title: ENGAGEMENT_SYSTEM_LABELS[system],
                  points: series.map(row => ({
                    label: row.label.slice(0, 3),
                    value: row.members[system],
                  })),
                }))}
                max={Math.max(
                  ...series.flatMap(row =>
                    ENGAGEMENT_SYSTEMS.map(system => row.members[system]),
                  ),
                )}
              />
              <details className="mt-2">
                <summary className={tableToggleClass}>Table view</summary>
                <Table.Root size="2">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell className={headerCellClass}>
                        Month
                      </Table.ColumnHeaderCell>
                      {ENGAGEMENT_SYSTEMS.map(system => (
                        <Table.ColumnHeaderCell
                          key={system}
                          className={`${numberHeaderClass} ${monthColumnClass(system)}`}
                        >
                          {ENGAGEMENT_SYSTEM_SHORT_LABELS[system]}
                        </Table.ColumnHeaderCell>
                      ))}
                      <Table.ColumnHeaderCell className={numberHeaderClass}>
                        Active
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {series.map(row => (
                      <Table.Row key={row.month} className={zebraStripeClass}>
                        <Table.Cell className="text-gray-300">
                          {row.label}
                        </Table.Cell>
                        {ENGAGEMENT_SYSTEMS.map(system => (
                          <Table.Cell
                            key={system}
                            className={`${numberCellClass} ${monthColumnClass(system)}`}
                          >
                            <Count value={row.members[system]} />
                          </Table.Cell>
                        ))}
                        <Table.Cell className={numberCellClass}>
                          <Count value={row.activeMembers} />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </details>
            </Box>
          </Box>
        </Tabs.Content>

        <Tabs.Content value="pvm">
          <PvmActivitySection days={days} />
          <Box mt="8" id={SECTION_IDS.skilling} className={sectionClass}>
            <SectionHeading title="Skilling only" />
            <Note>
              Online this period but under the PvM floor. EHP is the efficient
              hours they gained instead: high EHP with near-zero EHB is a
              committed skiller, not an inactive. Tenure cohorts, with PvM rates
              by join date, are on the{' '}
              <button
                type="button"
                className={proseLinkClass}
                onClick={() => goTo(SECTION_IDS.tenure)}
              >
                Members tab
              </button>
              .
            </Note>
            <SkillingOnlySection skilling={skilling} />
          </Box>
        </Tabs.Content>

        <Tabs.Content value="members">
          <ActivityByMonthSection clanFlows={clanFlows} />
          <Box mt="8" id={SECTION_IDS.tenure} className={sectionClass}>
            <SectionHeading title="By tenure" />
            <Note>
              The same rates for members by when they joined, over the last{' '}
              {days} days. The newest cohort is partly survivorship (members who
              joined and left are already off the roster), so read gaps as large
              or small, not exact.
            </Note>
            <Reading>
              Active in-game and touched a clan system: higher is better, and a
              cohort well below the others is the one drifting. At or above the
              floor is the share of a cohort&apos;s active members doing real
              PvM. Median EHB is the typical active member&apos;s PvM hours;
              medians ignore the few grinders. n is the cohort size.
            </Reading>
            {skilling.failure && !skilling.result ? (
              <Box py="2">
                <Retry
                  message={skilling.failure}
                  loading={skilling.loading}
                  onRetry={skilling.retry}
                />
              </Box>
            ) : !skilling.result ? (
              <Text as="p" size="2" className="py-2 text-gray-500">
                Reading Wise Old Man…
              </Text>
            ) : (
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  {
                    key: 'active',
                    title: 'Active in-game',
                    value: (cohort: (typeof skilling.result.tenure)[number]) =>
                      cohort.activeShare ?? 0,
                    percent: true,
                  },
                  {
                    key: 'systems',
                    title: 'Touched a clan system',
                    value: (cohort: (typeof skilling.result.tenure)[number]) =>
                      cohort.usedSystemShare ?? 0,
                    percent: true,
                  },
                  {
                    key: 'floor',
                    title: `At or above ${skilling.result.floor} EHB, of active`,
                    value: (cohort: (typeof skilling.result.tenure)[number]) =>
                      cohort.aboveFloorShare ?? 0,
                    percent: true,
                  },
                  {
                    key: 'median',
                    title: 'Median EHB gained, of active',
                    value: (cohort: (typeof skilling.result.tenure)[number]) =>
                      cohort.medianEhbActive,
                    percent: false,
                  },
                ].map(metric => (
                  <Box key={metric.key}>
                    <Text as="p" size="2" className="mb-1 text-gray-300">
                      {metric.title}
                    </Text>
                    <HorizontalBars
                      rows={(skilling.result?.tenure ?? []).map(cohort => ({
                        label: cohort.label.replace('Joined ', ''),
                        value: metric.value(cohort),
                        annotation: `n=${cohort.members}`,
                      }))}
                      max={metric.percent ? 100 : undefined}
                      formatValue={value =>
                        metric.percent ? `${value}%` : value.toLocaleString()
                      }
                      labelWidth={150}
                    />
                  </Box>
                ))}
              </div>
            )}
          </Box>
          <Box
            mt="8"
            id={SECTION_IDS.notParticipating}
            className={sectionClass}
          >
            <SectionHeading
              title="Not participating"
              summary={
                <Text size="2" className="text-gray-400">
                  {idleCount} of {rosterSize} members
                </Text>
              }
            />
            <Note>
              Members with no clan-system event in the last {days} days, plus
              members who were online but did no PvM. In-game: days since Wise
              Old Man last saw any account of theirs change. Clan activity: days
              since their last event, within the last {MONTHS_SHOWN} months. EHP
              and EHB: efficient hours played and bossed, gained this period.
            </Note>
            <Reading>
              Days are days since, so bigger means longer gone. Playing, not
              participating are the ones to invite to something; gone quiet are
              the ones to check on; not on Wise Old Man are the ones whose
              nickname or WOM entry needs fixing before anything here can see
              them.
            </Reading>
            <SubsectionHeading
              id={SECTION_IDS.playing}
              title="Playing, not participating"
              hint="active in-game this period, nothing in clan systems"
              summary={
                <Text size="2" className="text-gray-400">
                  {inactivity.playingNotParticipating.length}
                </Text>
              }
            />
            <InactiveTable
              rows={inactivity.playingNotParticipating}
              memberName={memberName}
              inGame
            />
            <SubsectionHeading
              id={SECTION_IDS.quiet}
              title="Gone quiet"
              hint="nothing in-game or in clan systems this period"
              summary={
                <Text size="2" className="text-gray-400">
                  {inactivity.goneQuiet.length}
                </Text>
              }
            />
            <InactiveTable
              rows={inactivity.goneQuiet}
              memberName={memberName}
              inGame
            />
            {inactivity.notOnWom.length > 0 && (
              <>
                <SubsectionHeading
                  title="Not on Wise Old Man"
                  hint="no account of theirs is in the group, so in-game is unknown"
                  summary={
                    <Text size="2" className="text-gray-400">
                      {inactivity.notOnWom.length}
                    </Text>
                  }
                />
                <InactiveTable
                  rows={inactivity.notOnWom}
                  memberName={memberName}
                  inGame={false}
                />
              </>
            )}
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}

/** Keeps a failure on this screen inside the admin chrome instead of the site-wide error page. */
export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong.';
  return (
    <Box>
      <Heading size="7" className="font-normal text-gray-100">
        Clan insights
      </Heading>
      <Text as="p" size="3" className="mt-2 text-gray-400">
        The page could not load: {message}
      </Text>
      <Text as="p" size="3" className="mt-2">
        <Link to="/admin/insights" className={proseLinkClass}>
          Try again
        </Link>
        {' or '}
        <Link to="/admin" className={proseLinkClass}>
          back to admin
        </Link>
        .
      </Text>
    </Box>
  );
}
