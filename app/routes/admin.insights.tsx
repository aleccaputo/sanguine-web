import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from '@remix-run/react';
import { Box, Flex, Heading, Select, Table, Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import { ReactNode, useEffect, useState } from 'react';
import { Button } from '~/components/button';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { requireStaff } from '~/services/auth.server';
import {
  getBountyListings,
  getEngagementEvents,
  getInGameActivityByDiscordId,
} from '~/services/engagement-service.server';
import type { IBountyListing } from '~/services/engagement-service.server';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { BOUNTY_STATUS } from '~/utils/bounty';
import { rankLabel } from '~/utils/clan-ranks';
import {
  ENGAGEMENT_SYSTEM_LABELS,
  ENGAGEMENT_SYSTEM_SHORT_LABELS,
  ENGAGEMENT_SYSTEMS,
  EngagementSystem,
  IInactiveMember,
  lastEventAtByMember,
  monthlyEngagementSeries,
  PVM_METRICS,
  PVM_PERIOD_DAYS,
  summarizeEngagement,
  summarizeInactivity,
} from '~/utils/engagement';
import { proseLinkClass, zebraStripeClass } from '~/utils/styles';
import type { loader as bountyScorecardLoader } from './admin.insights_.bounty.$id';
import type { loader as pvmActivityLoader } from './admin.insights_.pvm';

export const meta: MetaFunction = () => [{ title: 'Clan insights' }];

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_SHOWN = 6;
const MOST_ENGAGED_SHOWN = 25;
// How many bounty scorecards load on their own before the rest wait for a click, so a visit
// costs a bounded number of WOM reads.
const AUTO_MEASURED_BOUNTIES = 2;

const parseDays = (value: string | null): number => {
  const days = Number(value);
  return (PVM_PERIOD_DAYS as readonly number[]).includes(days) ? days : 30;
};

// Everything except the WOM gains, which the two resource routes serve on demand. The cached
// WOM membership list is read once for in-game activity.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const days = parseDays(new URL(request.url).searchParams.get('days'));
  const now = new Date();
  const windowStart = new Date(now.getTime() - days * DAY_MS).toISOString();
  const historyStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_SHOWN - 1), 1),
  ).toISOString();
  const [events, bounties, users] = await Promise.all([
    getEngagementEvents(historyStart),
    getBountyListings(),
    getUsersWithNicknames(),
  ]);
  const inGame = await getInGameActivityByDiscordId(users);
  const lastEvents = lastEventAtByMember(events);
  const summary = summarizeEngagement(events, windowStart, now.toISOString());
  const inactivity = summarizeInactivity(
    users.map(user => ({
      discordId: user.discordId,
      joined: user.joined,
      lastClanEventAt: lastEvents.get(user.discordId) ?? null,
      lastInGameChangeAt: inGame.get(user.discordId)?.lastChangedAt ?? null,
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
    activeMembers: summary.activeMembers,
    mostEngaged: summary.byMember.slice(0, MOST_ENGAGED_SHOWN),
    series: monthlyEngagementSeries(events, MONTHS_SHOWN, now),
    bounties,
    inactivity,
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

/** "label value" pair for the figure strips: gray label, white number. */
const Figure = ({ label, value }: { label: string; value: ReactNode }) => (
  <span className="whitespace-nowrap text-gray-400">
    {label} <span className="text-gray-100">{value}</span>
  </span>
);

/** One line under a heading saying what the numbers are. */
const Note = ({ children }: { children: ReactNode }) => (
  <Text as="p" size="2" className="mb-2 mt-1 text-gray-500">
    {children}
  </Text>
);

const NoData = () => (
  <Text as="p" size="2" className="py-4 text-gray-600">
    No data in this period.
  </Text>
);

const formatGain = (metric: string, value: number) =>
  metric === 'ehb'
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : Math.round(value).toLocaleString();

const formatDate = (iso: string) => dayjs(iso).format('MMM D, YYYY');

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

  const result = fetcher.data;
  const loading = fetcher.state !== 'idle';

  return (
    <Box mt="8">
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
      {!result ? (
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
          {result.activity.top.length === 0 ? (
            <NoData />
          ) : (
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
        </Box>
      )}
    </Box>
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
    inactivity,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

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
      <Flex gap="4" wrap="wrap" mt="2" mb="6">
        <Figure label="Roster" value={rosterSize.toLocaleString()} />
        <Figure
          label="Active in clan systems"
          value={`${activeMembers.toLocaleString()} (${percent(activeMembers)})`}
        />
        <Figure
          label="Idle"
          value={`${idleCount.toLocaleString()} (${percent(idleCount)})`}
        />
        <Figure
          label="Not on WOM"
          value={inactivity.notOnWom.length.toLocaleString()}
        />
      </Flex>

      <SectionHeading
        title="Bounty lift"
        summary={
          <Text size="2" className="text-gray-400">
            {bounties.length} posted
          </Text>
        }
      />
      <Note>
        Did it: members whose WOM kill count for the boss moved between the
        daily update before the bounty opened and the one after it closed.
        Before: the same span of time immediately prior. Lift: the difference. A
        tilde marks a window still waiting on the next update.
      </Note>
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
              />
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Box mt="8">
        <SectionHeading title="Systems engagement" />
        <Note>
          One event per drop posted, competition placing, Slayer task spun,
          bounty claim, and per participant of each raid or PB submission, in
          the last {days} days.
        </Note>
        {activeMembers === 0 ? (
          <NoData />
        ) : (
          <Flex direction={{ initial: 'column', lg: 'row' }} gap="6">
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
                            {percent(row.members)}
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
                    <Table.Row key={row.discordId} className={zebraStripeClass}>
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

      <PvmActivitySection days={days} />

      <Box mt="8">
        <SectionHeading
          title="Not participating"
          summary={
            <Text size="2" className="text-gray-400">
              {idleCount} of {rosterSize} members
            </Text>
          }
        />
        <Note>
          Members with no clan-system event in the last {days} days. In-game is
          when Wise Old Man last saw any account of theirs change; clan activity
          is their last event in the last {MONTHS_SHOWN} months.
        </Note>
        <SubsectionHeading
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
    </Box>
  );
}
