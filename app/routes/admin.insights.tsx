import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from '@remix-run/react';
import { Box, Flex, Select, Table, Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Button } from '~/components/button';
import { EmptyState } from '~/components/EmptyState';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { requireStaff } from '~/services/auth.server';
import {
  getBountyListings,
  getEngagementEvents,
} from '~/services/engagement-service.server';
import type { IBountyListing } from '~/services/engagement-service.server';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { BOUNTY_STATUS } from '~/utils/bounty';
import {
  ENGAGEMENT_SYSTEM_LABELS,
  ENGAGEMENT_SYSTEM_SHORT_LABELS,
  ENGAGEMENT_SYSTEMS,
  EngagementSystem,
  monthlyEngagementSeries,
  PVM_METRICS,
  PVM_PERIOD_DAYS,
  summarizeEngagement,
} from '~/utils/engagement';
import {
  proseLinkClass,
  zebraRowClass,
  zebraStripeClass,
} from '~/utils/styles';
import type { loader as bountyScorecardLoader } from './admin.insights_.bounty.$id';
import type { loader as pvmActivityLoader } from './admin.insights_.pvm';

export const meta: MetaFunction = () => [{ title: 'Clan insights' }];

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_OPTIONS = PVM_PERIOD_DAYS;
const MONTHS_SHOWN = 6;
const MOST_ENGAGED_SHOWN = 25;
// How many bounty scorecards load on their own before the rest wait for a click, so a visit
// costs a bounded number of WOM reads.
const AUTO_MEASURED_BOUNTIES = 3;

const parseDays = (value: string | null): number => {
  const days = Number(value);
  return (PERIOD_OPTIONS as readonly number[]).includes(days) ? days : 30;
};

// Everything except the WOM-backed numbers, which the two resource routes serve on demand.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const days = parseDays(new URL(request.url).searchParams.get('days'));
  const now = new Date();
  const since = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_SHOWN - 1), 1),
  ).toISOString();
  const [events, bounties, users] = await Promise.all([
    getEngagementEvents(since),
    getBountyListings(),
    getUsersWithNicknames(),
  ]);
  const summary = summarizeEngagement(
    events,
    new Date(now.getTime() - days * DAY_MS).toISOString(),
    now.toISOString(),
  );
  return json({
    days,
    rosterSize: users.length,
    names: Object.fromEntries(
      users.map(user => [user.discordId, user.nickname ?? null]),
    ) as Record<string, string | null>,
    bySystem: summary.bySystem,
    activeMembers: summary.activeMembers,
    mostEngaged: summary.byMember.slice(0, MOST_ENGAGED_SHOWN),
    series: monthlyEngagementSeries(events, MONTHS_SHOWN, now),
    bounties,
  });
}

const headerCellClass = 'text-osrs-orange';
const numberCellClass = 'text-right tabular-nums';
const numberHeaderClass = `${headerCellClass} text-right`;

const Count = ({ value }: { value: number }) => (
  <span className={value === 0 ? 'text-gray-600' : 'text-gray-100'}>
    {value.toLocaleString()}
  </span>
);

const formatGain = (metric: string, value: number) =>
  metric === 'ehb'
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : Math.round(value).toLocaleString();

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
}

function BountyRow({ bounty, autoLoad }: IBountyRowProps) {
  const fetcher = useFetcher<typeof bountyScorecardLoader>();
  const href = `/admin/insights/bounty/${bounty.id}`;
  const loading = fetcher.state !== 'idle';
  const result = fetcher.data;

  useEffect(() => {
    if (autoLoad && fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(href);
    }
  }, [autoLoad, fetcher, href]);

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
          onClick={() => fetcher.load(href)}
        >
          Measure
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
        <Flex align="center" gap="2">
          <Box className="hidden h-7 w-7 shrink-0 items-center justify-center sm:flex">
            <img
              src={bounty.bossImageUrl}
              alt=""
              className="max-h-7 max-w-7 object-contain"
            />
          </Box>
          <Flex direction="column">
            <Text size="2" className="text-gray-100">
              {bounty.bossDisplayName}
            </Text>
            <Text size="2" className="text-gray-500">
              <span className="whitespace-nowrap">
                {dayjs(bounty.postedAt).format('MMM D, YYYY')}
              </span>
              {' · '}
              <span className="whitespace-nowrap">
                {bountyStatusLabel(bounty)}
              </span>
            </Text>
            {result && result.scorecard.topParticipants.length > 0 && (
              <Text size="1" className="hidden text-gray-500 md:block">
                {result.scorecard.topParticipants
                  .map(row => `${row.displayName} ${row.gained}`)
                  .join(' · ')}
              </Text>
            )}
          </Flex>
        </Flex>
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

function PvmActivitySection() {
  const metrics = PVM_METRICS;
  const fetcher = useFetcher<typeof pvmActivityLoader>();
  const [metric, setMetric] = useState(metrics[0].metric);
  const [days, setDays] = useState('30');
  const href = `/admin/insights/pvm?metric=${metric}&days=${days}`;
  const label =
    metrics.find(option => option.metric === metric)?.label ?? metric;

  useEffect(() => {
    fetcher.load(href);
    // The fetcher object changes identity on every state change; only the target matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  const result = fetcher.data;
  const loading = fetcher.state !== 'idle';

  return (
    <Box mt="8">
      <SectionHeading
        title="PvM activity"
        summary={
          <Flex gap="2" align="center" wrap="wrap">
            <Select.Root value={metric} onValueChange={setMetric}>
              <Select.Trigger color="gray" />
              <Select.Content position="popper">
                {metrics.map(option => (
                  <Select.Item key={option.metric} value={option.metric}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Select.Root value={days} onValueChange={setDays}>
              <Select.Trigger color="gray" />
              <Select.Content position="popper">
                {PERIOD_OPTIONS.map(option => (
                  <Select.Item key={option} value={String(option)}>
                    Last {option} days
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        }
      />
      {!result ? (
        <Text as="p" size="3" className="mt-3 text-gray-500">
          {loading ? 'Reading Wise Old Man…' : 'Pick a metric to measure.'}
        </Text>
      ) : (
        <>
          <Text
            as="p"
            size="3"
            className={`mt-3 text-gray-400 ${loading ? 'opacity-60' : ''}`}
          >
            <span className="text-gray-100">
              {result.activity.activeMembers.toLocaleString()}
            </span>{' '}
            member{result.activity.activeMembers === 1 ? '' : 's'} moved{' '}
            {label.toLowerCase()} over the last {result.days} days, gaining{' '}
            <span className="text-gray-100">
              {formatGain(result.metric, result.activity.totalGained)}
            </span>{' '}
            in total, per Wise Old Man.
          </Text>
          {result.activity.top.length === 0 ? (
            <EmptyState />
          ) : (
            <Table.Root size="2" className="mt-3">
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
                  <Table.Row key={row.displayName} className={zebraStripeClass}>
                    <Table.Cell className={`${numberCellClass} text-gray-500`}>
                      {index + 1}
                    </Table.Cell>
                    <Table.Cell>
                      <a
                        href={`https://wiseoldman.net/players/${encodeURIComponent(row.displayName)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={proseLinkClass}
                      >
                        {row.displayName}
                      </a>
                    </Table.Cell>
                    <Table.Cell className={`${numberCellClass} text-gray-100`}>
                      {formatGain(result.metric, row.gained)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </>
      )}
    </Box>
  );
}

export default function AdminInsights() {
  const {
    days,
    rosterSize,
    names,
    bySystem,
    activeMembers,
    mostEngaged,
    series,
    bounties,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const memberName = (discordId: string) =>
    names[discordId] ?? `Unknown member (${discordId})`;
  const share = (members: number) =>
    rosterSize === 0 ? 0 : Math.round((members / rosterSize) * 100);
  const activeSystems = bySystem.filter(row => row.members > 0);

  return (
    <Box>
      <PageHeader title="Clan insights">
        In the last {days} days,{' '}
        <span className="text-gray-100">{activeMembers.toLocaleString()}</span>{' '}
        of <span className="text-gray-100">{rosterSize.toLocaleString()}</span>{' '}
        members touched at least one clan system
        {activeSystems.length > 0 ? ': ' : '.'}
        {activeSystems.map((row, index) => (
          <span key={row.system}>
            <span className="text-gray-100">
              {row.members.toLocaleString()}
            </span>{' '}
            {ENGAGEMENT_SYSTEM_LABELS[row.system].toLowerCase()}
            {index < activeSystems.length - 1 ? ', ' : '.'}
          </span>
        ))}
      </PageHeader>

      <SectionHeading
        title="Bounties as motivators"
        summary={
          <Text size="3" className="text-gray-400">
            <span className="text-gray-100">{bounties.length}</span> posted
          </Text>
        }
      />
      {bounties.length === 0 ? (
        <EmptyState>No bounties have been posted yet.</EmptyState>
      ) : (
        <>
          <Table.Root size="2" className="mt-3">
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
                  Hours open
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {bounties.map((bounty, index) => (
                <BountyRow
                  key={bounty.id}
                  bounty={bounty}
                  autoLoad={index < AUTO_MEASURED_BOUNTIES}
                />
              ))}
            </Table.Body>
          </Table.Root>
          <Text as="p" size="2" className="mt-2 text-gray-500">
            Did it counts members whose Wise Old Man kill count for the boss
            moved between the daily update before the bounty opened and the one
            after it closed. Before is the same length of time immediately
            prior. Lift is the difference. A tilde marks a window still waiting
            on the next update.
          </Text>
        </>
      )}

      <Box mt="8">
        <SectionHeading
          title="Systems engagement"
          summary={
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
                {PERIOD_OPTIONS.map(option => (
                  <Select.Item key={option} value={String(option)}>
                    Last {option} days
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          }
        />
        {activeMembers === 0 ? (
          <EmptyState />
        ) : (
          <Flex direction={{ initial: 'column', lg: 'row' }} gap="6" mt="1">
            <Box className="lg:w-2/5">
              <SubsectionHeading title="By system" />
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
                      Events
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {bySystem.map(row => (
                    <Table.Row key={row.system} className={zebraStripeClass}>
                      <Table.Cell className="text-gray-300">
                        {ENGAGEMENT_SYSTEM_LABELS[row.system]}
                      </Table.Cell>
                      <Table.Cell className={numberCellClass}>
                        <Count value={row.members} />
                        {row.members > 0 && (
                          <Text size="1" className="ml-1 text-gray-500">
                            {share(row.members)}%
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell className={numberCellClass}>
                        <Count value={row.events} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
            <Box className="lg:w-3/5">
              <SubsectionHeading
                title="Most engaged"
                hint={`top ${Math.min(mostEngaged.length, MOST_ENGAGED_SHOWN)}, by systems touched then events`}
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
                      Events
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {mostEngaged.map((row, index) => (
                    <Table.Row key={row.discordId} className={zebraRowClass}>
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
                        <Text size="1" className="ml-1 text-gray-500 sm:hidden">
                          {row.systems.length} of {ENGAGEMENT_SYSTEMS.length}
                        </Text>
                      </Table.Cell>
                      <Table.Cell className="hidden text-gray-400 sm:table-cell">
                        {row.systems
                          .map(
                            (system: EngagementSystem) =>
                              ENGAGEMENT_SYSTEM_LABELS[system],
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
            hint="distinct members per system"
          />
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
                  <Table.Cell className="text-gray-300">{row.label}</Table.Cell>
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
        </Box>
      </Box>

      <PvmActivitySection />
    </Box>
  );
}
