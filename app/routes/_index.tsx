import { defer, MetaFunction } from '@remix-run/node';
import { Container, Heading, Text, Box, Flex } from '@radix-ui/themes';
import { Await, Link, useLoaderData } from '@remix-run/react';
import { Suspense } from 'react';
import dayjs from 'dayjs';
import { DiscordWidget } from '~/components/DiscordWidget';
import { DropItem } from '~/components/DropItem';
import { EmptyState } from '~/components/EmptyState';
import { SectionHeading } from '~/components/SectionHeading';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import {
  getCompetitionById,
  getCompetitions,
} from '~/services/wom-api-service.server';
import { SPECIAL_COMPETITION_IDS } from '~/utils/events-config';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import {
  getClanDropsPaginated,
  getLegacyCompetitionPointsByDiscordId,
} from '~/data/points-audit';
import { getAllUserAlts } from '~/data/user';
import {
  getMonthlyWinners,
  MonthlyWinnerEventType,
} from '~/data/monthly-winners';
import {
  buildAltsByDiscordId,
  resolveDisplayName,
  resolveDisplayParts,
} from '~/utils/account-matching';
import { getCompetitionImageUrl } from '~/utils/competition-images';
import { proseLinkClass, zebraRowClass } from '~/utils/styles';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine - OSRS Clan' },
    {
      name: 'description',
      content:
        'Welcome to Sanguine - A Premier Old School RuneScape PvM and Social Clan',
    },
  ];
};

const EVENT_LABELS: Record<MonthlyWinnerEventType, string> = {
  BOSS: 'Boss of the Week',
  RAID: 'Raid of the Week',
  SKILL: 'Skill of the Week',
};

const EVENT_TYPES: MonthlyWinnerEventType[] = ['BOSS', 'RAID', 'SKILL'];

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
  const usersPromise = getUsersWithNicknames();
  const altsPromise = getAllUserAlts();

  // The lede narrates real numbers instead of hard-coded ones; deferred so the
  // hero paints immediately even when the services are cold.
  const statsPromise = Promise.all([
    usersPromise,
    getLegacyCompetitionPointsByDiscordId(),
    altsPromise,
  ]).then(([users, legacyCompetitionPoints, allAlts]) => {
    const members = users.filter(user => user.nickname);
    // Members play across multiple accounts — the clan counts alts too
    const memberDiscordIds = new Set(members.map(user => user.discordId));
    const altCount = allAlts.filter(alt =>
      memberDiscordIds.has(alt.discordId),
    ).length;
    return {
      memberCount: members.length + altCount,
      totalDropPoints: members.reduce((sum, user) => sum + user.points, 0),
      // Pre-cutover COMPETITION awards count as clan points retroactively —
      // same adjustment the roster applies.
      totalClanPoints: members.reduce(
        (sum, user) =>
          sum +
          user.clanPoints +
          (legacyCompetitionPoints[user.discordId] ?? 0),
        0,
      ),
    };
  });

  // The noticeboard: what's actually happening around the clan right now.
  const activityPromise = Promise.all([
    getClanDropsPaginated(1, 5),
    usersPromise,
    altsPromise,
    getMonthlyWinners(),
  ]).then(async ([{ drops }, users, allAlts, winners]) => {
    const altsByDiscordId = buildAltsByDiscordId(allAlts);
    const nicknameMap = Object.fromEntries(
      users.map(u => [u.discordId, u.nickname ?? u.discordId]),
    );

    const latestDrops = await Promise.all(
      drops.map(async item => {
        const user = users.find(
          u => u.discordId === item.destinationDiscordId,
        );
        const osrsData =
          item.itemId !== null ? await fetchOSRSItem(item.itemId) : null;
        const mainName = user?.nickname ?? user?.discordId ?? '';
        const nickname = resolveDisplayName(
          item.osrsName,
          mainName,
          altsByDiscordId.get(item.destinationDiscordId) ?? new Set(),
        );
        return { ...item, osrsData, nickname };
      }),
    );

    const champions = EVENT_TYPES.flatMap(type => {
      const winner = winners.find(w => w.type === type);
      if (!winner) return [];
      const { name } = resolveDisplayParts(
        winner.winnerOsrsName,
        nicknameMap[winner.winnerDiscordId] ?? winner.winnerDiscordId,
        altsByDiscordId.get(winner.winnerDiscordId) ?? new Set(),
      );
      return [
        {
          type,
          discordId: winner.winnerDiscordId,
          displayName: name,
          metric: winner.metric,
        },
      ];
    });

    return { latestDrops, champions };
  });

  // WOM can be slow on a cold cache — its section streams in on its own.
  // Special comps (bingos, inter-clan events) live outside the group list.
  const competitionsPromise = Promise.all([
    getCompetitions(),
    ...SPECIAL_COMPETITION_IDS.map(id => getCompetitionById(id)),
  ]).then(([womComps, ...specials]) => {
    const now = Date.now();
    const seen = new Set<number>();
    return [...specials, ...(womComps ?? [])]
      .filter(comp => {
        if (!comp || seen.has(comp.id)) return false;
        seen.add(comp.id);
        return (
          new Date(comp.startsAt).getTime() <= now &&
          now <= new Date(comp.endsAt).getTime()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime(),
      )
      .slice(0, 4)
      .map(comp => ({
        id: comp.id,
        title: comp.title,
        metric: comp.metric,
        endsAt: comp.endsAt,
        participantCount: comp.participantCount,
      }));
  });

  return defer(
    {
      stats: statsPromise,
      activity: activityPromise,
      competitions: competitionsPromise,
    },
    { headers: { 'Cache-Control': 'max-age=300' } },
  );
}

const PILLARS = [
  {
    title: 'Elite PvM',
    body: 'ToB/ToB HM, CoX/CoX CM, ToA, Yama, Nex and more',
  },
  {
    title: 'Active community',
    body: 'Dedicated OSRS players working together',
  },
  {
    title: 'Competitions',
    body: 'Weekly challenges, bingo events, and skill competitions',
  },
] as const;

/** Pulse rows shaped like the noticeboard lists while a section streams in. */
const RowsSkeleton = ({ rows }: { rows: number }) => (
  <Box mt="2">
    {Array.from({ length: rows }, (_, idx) => (
      <Flex
        key={idx}
        align="center"
        gap="3"
        className={`px-2 py-2.5 ${idx % 2 === 1 ? 'bg-sanguine-red/[0.05]' : ''}`}
      >
        <div className="h-6 w-6 shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
        <div className="h-4 max-w-56 flex-1 animate-pulse rounded-sm bg-gray-800/50"></div>
      </Flex>
    ))}
  </Box>
);

const sectionLink = 'text-sm text-sanguine-bright transition-colors hover:text-white';

export default function Index() {
  const { stats, activity, competitions } = useLoaderData<typeof loader>();

  return (
    <Container size="3" mt="3" pb="6">
      {/* Hero — the clan introduced the way its wiki article would open */}
      <Box mt="4">
        <Flex align="center" gap="3">
          <img src="/sanguine_icon_small.png" alt="" width={44} height={44} />
          <Heading size="8" className="font-normal text-sanguine-bright">
            Sanguine
          </Heading>
        </Flex>
        <Text as="p" size="3" className="mt-3 max-w-3xl leading-7 text-gray-300">
          <strong className="font-medium text-white">Sanguine</strong> is an
          Old School RuneScape PvM and social clan
          <Suspense fallback={<>.</>}>
            <Await resolve={stats}>
              {({ memberCount, totalDropPoints, totalClanPoints }) => (
                <>
                  {' '}
                  of{' '}
                  <Link to="/users" className={proseLinkClass}>
                    <span className="font-semibold">{memberCount} members</span>
                  </Link>
                  , together holding{' '}
                  <span className="font-semibold text-white">
                    {totalDropPoints.toLocaleString()}
                  </span>{' '}
                  <Link to="/drops" className={proseLinkClass}>
                    drop points
                  </Link>{' '}
                  and{' '}
                  <span className="font-semibold text-osrs-gold">
                    {totalClanPoints.toLocaleString()}
                  </span>{' '}
                  clan points.
                </>
              )}
            </Await>
          </Suspense>{' '}
          Find us in-game in the clan chat{' '}
          <span className="text-white">Sanguine PvM</span> on home world{' '}
          <span className="text-white">479</span>, most active during EST/PST
          hours.
        </Text>

        <img
          src="/SanguinePersonalBanner.png"
          alt="Sanguine Banner"
          className="mt-6 h-auto max-w-full rounded-sm"
        />
      </Box>

      {/* The noticeboard: live clan activity in two dense columns */}
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-x-8">
        <section>
          <SectionHeading
            title="Latest drops"
            summary={
              <Link to="/drops" className={sectionLink}>
                Full drop log
              </Link>
            }
          />
          <Suspense fallback={<RowsSkeleton rows={5} />}>
            <Await resolve={activity}>
              {({ latestDrops }) =>
                latestDrops.length > 0 ? (
                  <Box mt="2">
                    {latestDrops.map(item => (
                      <div key={item.id} className={`px-2 ${zebraRowClass}`}>
                        <DropItem
                          item={item}
                          nickname={item.nickname}
                          showRecipient={true}
                          size="small"
                        />
                      </div>
                    ))}
                  </Box>
                ) : (
                  <EmptyState />
                )
              }
            </Await>
          </Suspense>
        </section>

        <div className="min-w-0">
          <section>
            <SectionHeading
              title="Happening now"
              summary={
                <Link to="/events" className={sectionLink}>
                  All events
                </Link>
              }
            />
            <Suspense fallback={<RowsSkeleton rows={3} />}>
              <Await resolve={competitions}>
                {comps =>
                  comps.length > 0 ? (
                    <Box mt="2">
                      {comps.map(comp => (
                        <Link
                          key={comp.id}
                          to={`/events/${comp.id}`}
                          className={`group flex items-center gap-3 px-2 py-2 ${zebraRowClass}`}
                        >
                          <img
                            src={getCompetitionImageUrl(comp.metric)}
                            alt=""
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                          <Box className="min-w-0 flex-1">
                            <Text
                              as="div"
                              className="truncate leading-tight text-sanguine-bright group-hover:text-white"
                            >
                              {comp.title}
                            </Text>
                            <Text as="div" size="1" className="text-gray-500">
                              ends {dayjs(comp.endsAt).format('MMM D')}
                            </Text>
                          </Box>
                          {comp.participantCount > 0 && (
                            <Text
                              size="2"
                              className="shrink-0 text-gray-400"
                            >
                              {comp.participantCount} players
                            </Text>
                          )}
                        </Link>
                      ))}
                    </Box>
                  ) : (
                    <EmptyState />
                  )
                }
              </Await>
            </Suspense>
          </section>

          <section className="mt-10">
            <SectionHeading
              title="Reigning champions"
              summary={
                <Link to="/monthly-winners" className={sectionLink}>
                  Monthly winners
                </Link>
              }
            />
            <Suspense fallback={<RowsSkeleton rows={3} />}>
              <Await resolve={activity}>
                {({ champions }) =>
                  champions.length > 0 ? (
                    <Box mt="2">
                      {champions.map(champion => (
                        <Link
                          key={champion.type}
                          to={`/users/${champion.discordId}`}
                          className={`group flex items-center gap-3 px-2 py-2 ${zebraRowClass}`}
                        >
                          <img
                            src={RANK_ICON[champion.type]}
                            alt={EVENT_LABELS[champion.type]}
                            width={22}
                            height={22}
                            className="shrink-0 [image-rendering:pixelated]"
                          />
                          <Box className="min-w-0 flex-1">
                            <Text
                              as="div"
                              className="truncate leading-tight text-sanguine-bright group-hover:text-white"
                            >
                              {champion.displayName}
                            </Text>
                            <Text as="div" size="1" className="text-gray-500">
                              {EVENT_LABELS[champion.type]}
                            </Text>
                          </Box>
                          <Text
                            size="2"
                            className="min-w-0 shrink-0 truncate text-gray-400"
                          >
                            {humanizeMetric(champion.metric)}
                          </Text>
                        </Link>
                      ))}
                    </Box>
                  ) : (
                    <EmptyState />
                  )
                }
              </Await>
            </Suspense>
          </section>
        </div>
      </div>

      {/* What we do — typographic columns, no cards */}
      <section className="mt-10">
        <SectionHeading title="What we do" />
        <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5">
          {PILLARS.map(pillar => (
            <Box key={pillar.title}>
              <Text as="p" size="3" className="text-osrs-orange">
                {pillar.title}
              </Text>
              <Text as="p" size="3" className="mt-1 text-gray-400">
                {pillar.body}
              </Text>
            </Box>
          ))}
        </div>
      </section>

      {/* Join us */}
      <section className="mt-10">
        <SectionHeading
          title="Join us"
          summary={
            <Text size="2" className="text-gray-500">
              110+ combat
            </Text>
          }
        />
        <Text as="p" size="3" className="mt-3 max-w-3xl leading-7 text-gray-300">
          Applications go through Discord: introduce yourself and a staff
          member will get you ranked in the clan chat. We ask for{' '}
          <span className="text-white">110+ combat</span>; everything else you
          can read on the{' '}
          <Link to="/about" className={proseLinkClass}>
            about page
          </Link>
          .
        </Text>
        <Box mt="4">
          <DiscordWidget />
        </Box>
      </section>
    </Container>
  );
}
