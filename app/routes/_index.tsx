import { defer, MetaFunction } from '@remix-run/node';
import { Container, Heading, Text, Box, Flex } from '@radix-ui/themes';
import { Await, Link, useLoaderData } from '@remix-run/react';
import { Suspense } from 'react';
import { DiscordWidget } from '~/components/DiscordWidget';
import { SectionHeading } from '~/components/SectionHeading';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getLegacyCompetitionPointsByDiscordId } from '~/data/points-audit';
import { getAllUserAlts } from '~/data/user';
import { proseLinkClass } from '~/utils/styles';

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

export async function loader() {
  // The lede narrates real numbers instead of hard-coded ones; deferred so the
  // hero paints immediately even when the services are cold.
  const statsPromise = Promise.all([
    getUsersWithNicknames(),
    getLegacyCompetitionPointsByDiscordId(),
    getAllUserAlts(),
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

  return defer(
    { stats: statsPromise },
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

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();

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
          Find us in-game at clan chat{' '}
          <span className="text-white">Sanguine PvM</span> on home world{' '}
          <span className="text-white">479</span>, keeping EST/PST hours, or
          around the{' '}
          <Link to="/events" className={proseLinkClass}>
            competitions
          </Link>{' '}
          and{' '}
          <Link to="/personal-bests" className={proseLinkClass}>
            personal-best boards
          </Link>
          .
        </Text>

        <img
          src="/SanguinePersonalBanner.png"
          alt="Sanguine Banner"
          className="mt-6 h-auto max-w-full rounded-sm"
        />
      </Box>

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
