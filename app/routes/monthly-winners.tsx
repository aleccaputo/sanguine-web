import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import {
  Avatar,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes';
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
import { getCompetitionImageUrl } from '~/utils/competition-images';

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

const EVENT_LABELS: Record<MonthlyWinnerEventType, string> = {
  BOSS: 'Boss of the Week',
  RAID: 'Raid of the Week',
  SKILL: 'Skill of the Week',
};

const EVENT_COLUMNS: MonthlyWinnerEventType[] = ['BOSS', 'RAID', 'SKILL'];

const RANK_ICON: Record<MonthlyWinnerEventType, string> = {
  BOSS: '/rank-icons/botw_winner_rank.png',
  RAID: '/rank-icons/rotw_winner_rank.png',
  SKILL: '/rank-icons/sotw_winner_rank.png',
};

const TITLE_CASE_LOWERCASE_WORDS = new Set(['of', 'the', 'a', 'an']);

const humanizeMetric = (metric: string | null) => {
  if (!metric) return 'Unknown';
  return metric
    .split('_')
    .map((part, i) => {
      if (!part.length) return part;
      if (i > 0 && TITLE_CASE_LOWERCASE_WORDS.has(part)) return part;
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(' ');
};

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

const ReigningCard = ({
  type,
  winner,
  nextEventEndIso,
}: {
  type: MonthlyWinnerEventType;
  winner: WinnerWithName | undefined;
  nextEventEndIso: string | null;
}) => (
  <Card className="flex-1 border border-sanguine-red/40 bg-gray-900 shadow-lg shadow-sanguine-red/10">
    <Box p="5">
      <Text size="1" className="uppercase tracking-widest text-sanguine-red">
        {EVENT_LABELS[type]}
      </Text>
      {winner ? (
        <Flex direction="column" gap="4" mt="4">
          <Flex gap="3" align="center">
            <Avatar
              size="4"
              src={getCompetitionImageUrl(winner.metric ?? '')}
              radius="medium"
              fallback="S"
            />
            <Flex direction="column" className="min-w-0 flex-1">
              <Flex gap="2" align="center" className="min-w-0">
                <img
                  src={RANK_ICON[type]}
                  alt={`${EVENT_LABELS[type]} winner rank`}
                  className="h-5 w-5 flex-shrink-0 object-contain"
                />
                <Link
                  to={`/users/${winner.winnerDiscordId}`}
                  className="min-w-0 text-white transition-colors hover:text-sanguine-red"
                >
                  <Heading size="5" className="truncate leading-tight">
                    {winner.displayName}
                  </Heading>
                </Link>
              </Flex>
              {winner.mainAccount && (
                <Text size="1" className="truncate pl-7 text-gray-400">
                  aka {winner.mainAccount}
                </Text>
              )}
              <Text size="2" className="pl-7 text-gray-400">
                {humanizeMetric(winner.metric)}
              </Text>
            </Flex>
          </Flex>
          <Flex justify="between" gap="2" className="text-gray-400">
            <Text size="1">
              Won {dayjs(winner.endDate).format('MMM D, YYYY')}
            </Text>
            {nextEventEndIso && (
              <Text size="1">
                Next winner {dayjs(nextEventEndIso).format('MMM D')}
              </Text>
            )}
          </Flex>
        </Flex>
      ) : (
        <Flex direction="column" gap="2" mt="4">
          <Text size="2" className="text-gray-400">
            No winner crowned yet
          </Text>
          {nextEventEndIso && (
            <Text size="1" className="text-gray-500">
              First winner {dayjs(nextEventEndIso).format('MMM D')}
            </Text>
          )}
        </Flex>
      )}
    </Box>
  </Card>
);

const PastWinnerRow = ({ winner }: { winner: WinnerWithName }) => (
  <Flex
    gap="3"
    align="center"
    className="rounded-md border border-gray-800 bg-gray-950 p-2"
  >
    <Avatar
      size="2"
      src={getCompetitionImageUrl(winner.metric ?? '')}
      radius="full"
      fallback="S"
    />
    <Flex direction="column" className="min-w-0 flex-1">
      <Text size="2" weight="medium" className="truncate text-white">
        {humanizeMetric(winner.metric)}
      </Text>
      <Link
        to={`/users/${winner.winnerDiscordId}`}
        className="truncate text-sanguine-red transition-colors hover:text-white"
      >
        <Text size="1">
          {winner.mainAccount
            ? `${winner.displayName} (${winner.mainAccount})`
            : winner.displayName}
        </Text>
      </Link>
    </Flex>
    <Text size="1" className="whitespace-nowrap text-gray-500">
      {dayjs(winner.startDate).format('MMM YYYY')}
    </Text>
  </Flex>
);

export default function MonthlyWinners() {
  const { winners, nextEventEndsByType } = useLoaderData<typeof loader>();

  const winnersByType = EVENT_COLUMNS.reduce<
    Record<MonthlyWinnerEventType, WinnerWithName[]>
  >(
    (acc, type) => ({
      ...acc,
      [type]: winners.filter(w => w.type === type),
    }),
    { BOSS: [], RAID: [], SKILL: [] },
  );

  return (
    <Container size="4" mt="3" px="3">
      <Flex direction="column" gap="6">
        <Box className="text-center">
          <Heading size="6" className="tracking-wide text-sanguine-red">
            Monthly Winners
          </Heading>
          <Box className="mx-auto mt-2 h-1 w-32 bg-sanguine-red"></Box>
          <Text size="3" className="mt-3 text-gray-400">
            Boss, Raid, and Skill of the Week champions
          </Text>
        </Box>

        <Flex direction="column" gap="3">
          <Heading size="4" className="text-white">
            Reigning Champions
          </Heading>
          <Flex direction={{ initial: 'column', md: 'row' }} gap="4">
            {EVENT_COLUMNS.map(type => (
              <ReigningCard
                key={type}
                type={type}
                winner={winnersByType[type][0]}
                nextEventEndIso={nextEventEndsByType[type]}
              />
            ))}
          </Flex>
        </Flex>

        <Flex direction="column" gap="3">
          <Heading size="4" className="text-white">
            Past Winners
          </Heading>
          <Flex direction={{ initial: 'column', md: 'row' }} gap="4">
            {EVENT_COLUMNS.map(type => {
              const past = winnersByType[type].slice(1);
              return (
                <Flex key={type} direction="column" gap="2" className="flex-1">
                  <Text size="2" className="text-gray-400">
                    {EVENT_LABELS[type]}
                  </Text>
                  {past.length === 0 ? (
                    <Box className="rounded-md border border-gray-800 bg-gray-950 p-3">
                      <Text size="1" className="text-gray-500">
                        No past winners yet
                      </Text>
                    </Box>
                  ) : (
                    past.map(winner => (
                      <PastWinnerRow key={winner.eventId} winner={winner} />
                    ))
                  )}
                </Flex>
              );
            })}
          </Flex>
        </Flex>

        <Box mb="6" />
      </Flex>
    </Container>
  );
}
