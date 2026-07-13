import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { Box, Container, Flex, Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import {
  getMonthlyWinners,
  getUpcomingEventEndDates,
  MonthlyWinner,
  MonthlyWinnerEventType,
} from '~/data/monthly-winners';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAllUserAlts } from '~/data/user';
import {
  buildAltsByDiscordId,
  resolveDisplayParts,
} from '~/utils/account-matching';
import {
  getCompetitionImageUrl,
  humanizeMetric,
} from '~/utils/competition-images';
import {
  EVENT_LABELS,
  EVENT_TYPES,
  RANK_ICON,
} from '~/utils/monthly-winners-display';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading } from '~/components/SectionHeading';
import { EmptyState } from '~/components/EmptyState';
import { proseLinkClass, zebraRowClass } from '~/utils/styles';

type WinnerWithName = MonthlyWinner & {
  displayName: string;
  mainAccount: string | null;
};

export const meta: MetaFunction = () => [
  { title: 'Monthly Winners | Sanguine' },
  {
    name: 'description',
    content: 'Monthly Boss, Raid, and Skill of the Week winners',
  },
];

export async function loader() {
  const [winners, users, allAlts, nextEventEndsByType] = await Promise.all([
    getMonthlyWinners(),
    getUsersWithNicknames(),
    getAllUserAlts(),
    getUpcomingEventEndDates(),
  ]);
  const altsByDiscordId = buildAltsByDiscordId(allAlts);
  const nicknameMap = Object.fromEntries(
    users.map(u => [u.discordId, u.nickname ?? u.discordId]),
  );
  const winnersWithNames: WinnerWithName[] = winners.map(winner => {
    const { name, mainAccount } = resolveDisplayParts(
      winner.winnerOsrsName,
      nicknameMap[winner.winnerDiscordId] ?? winner.winnerDiscordId,
      altsByDiscordId.get(winner.winnerDiscordId) ?? new Set(),
    );
    return { ...winner, displayName: name, mainAccount };
  });
  return json(
    { winners: winnersWithNames, nextEventEndsByType },
    { headers: { 'Cache-Control': 'max-age=300' } },
  );
}

interface IReigningChampionProps {
  type: MonthlyWinnerEventType;
  winner: WinnerWithName | undefined;
  nextEventEndIso: string | null;
}

/** One column of the reigning-champions band: the current title holder. */
const ReigningChampion = ({
  type,
  winner,
  nextEventEndIso,
}: IReigningChampionProps) => {
  if (!winner) {
    return (
      <Box className="py-2">
        <Text as="p" size="3" className="text-gray-600">
          No winner crowned yet
        </Text>
        {nextEventEndIso && (
          <Text as="p" size="2" className="mt-1 text-gray-500">
            First winner {dayjs(nextEventEndIso).format('MMM D')}
          </Text>
        )}
      </Box>
    );
  }
  return (
    <Box className="py-1.5">
      <Flex align="center" gap="3">
        <img
          src={RANK_ICON[type]}
          alt={`${EVENT_LABELS[type]} winner rank`}
          width={22}
          height={22}
          className="shrink-0 [image-rendering:pixelated]"
        />
        <Link
          to={`/users/${winner.winnerDiscordId}`}
          className="min-w-0 flex-1"
        >
          <Text
            as="div"
            className="truncate text-xl leading-tight text-sanguine-bright hover:text-white"
          >
            {winner.displayName}
          </Text>
        </Link>
      </Flex>
      {winner.mainAccount && (
        <Text as="p" size="1" className="truncate pl-9 text-gray-500">
          aka {winner.mainAccount}
        </Text>
      )}
      <Flex align="center" gap="2" className="mt-1 pl-9">
        <img
          src={getCompetitionImageUrl(winner.metric ?? '')}
          alt=""
          className="h-5 w-5 shrink-0 object-contain"
        />
        <Text size="3" className="truncate text-gray-200">
          {humanizeMetric(winner.metric)}
        </Text>
      </Flex>
      <Text as="p" size="2" className="mt-1 pl-9 text-gray-500">
        Won {dayjs(winner.endDate).format('MMM D, YYYY')}
        {nextEventEndIso && (
          <> · next winner {dayjs(nextEventEndIso).format('MMM D')}</>
        )}
      </Text>
    </Box>
  );
};

interface IPastWinnerRowProps {
  winner: WinnerWithName;
}

/** One past title in a column: metric over the winner's name, month at right. */
const PastWinnerRow = ({ winner }: IPastWinnerRowProps) => (
  <Flex gap="3" align="center" className={`px-2 py-2 ${zebraRowClass}`}>
    <img
      src={getCompetitionImageUrl(winner.metric ?? '')}
      alt=""
      className="h-6 w-6 shrink-0 object-contain"
    />
    <Box className="min-w-0 flex-1">
      <Text as="div" size="2" className="truncate text-white">
        {humanizeMetric(winner.metric)}
      </Text>
      <Link
        to={`/users/${winner.winnerDiscordId}`}
        className={`block truncate ${proseLinkClass}`}
      >
        <Text size="2">
          {winner.displayName}
          {winner.mainAccount && (
            <span className="text-gray-500"> ({winner.mainAccount})</span>
          )}
        </Text>
      </Link>
    </Box>
    <Text size="2" className="whitespace-nowrap text-gray-400">
      {dayjs(winner.startDate).format('MMM YYYY')}
    </Text>
  </Flex>
);

export default function MonthlyWinners() {
  const { winners, nextEventEndsByType } = useLoaderData<typeof loader>();

  const winnersByType = EVENT_TYPES.reduce<
    Record<MonthlyWinnerEventType, WinnerWithName[]>
  >(
    (acc, type) => ({
      ...acc,
      [type]: winners.filter(w => w.type === type),
    }),
    { BOSS: [], RAID: [], SKILL: [] },
  );

  const pastWinnersCount = EVENT_TYPES.reduce(
    (sum, type) => sum + Math.max(0, winnersByType[type].length - 1),
    0,
  );
  const earliestStart = winners
    .map(w => w.startDate)
    .sort((a, b) => a.localeCompare(b))[0];
  const nextCrowning = EVENT_TYPES.map(type => nextEventEndsByType[type])
    .filter((iso): iso is string => iso !== null)
    .sort((a, b) => a.localeCompare(b))[0];

  return (
    <Container size="3" mt="3">
      <Flex direction="column">
        <PageHeader title="Monthly winners" iconSrc="/sanguine_icon_small.png">
          {winners.length > 0 ? (
            <>
              <span className="font-semibold text-white">{winners.length}</span>{' '}
              champions crowned across the weekly Boss, Raid, and Skill
              rotations
              {earliestStart && (
                <> since {dayjs(earliestStart).format('MMMM YYYY')}</>
              )}
              {nextCrowning && (
                <>, the next on {dayjs(nextCrowning).format('MMM D')}</>
              )}
            </>
          ) : (
            <>So far, nothing interesting happens.</>
          )}
        </PageHeader>

        {/* Reigning champions: flat three-column band under one red rule */}
        <Box
          mb="6"
          className="border-b border-t-2 border-gray-800 border-t-sanguine-red"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3">
            {EVENT_TYPES.map((type, index) => (
              <div
                key={type}
                className={
                  index > 0
                    ? 'border-t border-gray-800 pb-2 sm:border-l sm:border-t-0 sm:pl-5'
                    : 'pb-2 sm:pr-5'
                }
              >
                <Text as="p" size="2" className="pt-2 text-gray-500">
                  {EVENT_LABELS[type]}
                </Text>
                <ReigningChampion
                  type={type}
                  winner={winnersByType[type][0]}
                  nextEventEndIso={nextEventEndsByType[type]}
                />
              </div>
            ))}
          </div>
        </Box>

        {/* Past winners: three dense zebra columns, one per rotation */}
        <SectionHeading
          title="Past winners"
          summary={
            pastWinnersCount > 0 ? (
              <Text size="2" className="text-gray-500">
                <span className="text-white">{pastWinnersCount}</span> former
                champions
              </Text>
            ) : undefined
          }
        />
        {pastWinnersCount === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-5">
            {EVENT_TYPES.map(type => {
              const past = winnersByType[type].slice(1);
              return (
                <Box key={type} className="min-w-0">
                  <Text
                    as="p"
                    size="3"
                    className="border-b border-gray-700 pb-1 text-osrs-orange"
                  >
                    {EVENT_LABELS[type]}
                  </Text>
                  {past.length === 0 ? (
                    <Text as="p" size="2" className="px-2 py-3 text-gray-600">
                      Nothing interesting happens.
                    </Text>
                  ) : (
                    // Rows get their own parent so the zebra's even-child
                    // count starts at the first row, not the column header.
                    <Box>
                      {past.map(winner => (
                        <PastWinnerRow key={winner.eventId} winner={winner} />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </div>
        )}

        <Box mb="6" />
      </Flex>
    </Container>
  );
}
