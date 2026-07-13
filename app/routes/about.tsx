import { json, MetaFunction } from '@remix-run/node';
import { Container, Heading, Text, Box, Flex } from '@radix-ui/themes';
import { Link, useLoaderData } from '@remix-run/react';
import { DiscordWidget } from '~/components/DiscordWidget';
import { Infobox, InfoboxBand, InfoboxRow } from '~/components/Infobox';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAllUserAlts } from '~/data/user';
import { proseLinkClass, zebraStripeClass } from '~/utils/styles';

export const meta: MetaFunction = () => {
  return [
    { title: 'About Sanguine' },
    {
      name: 'description',
      content:
        'Sanguine, an OSRS PvM and social clan: what we raid, how points work, and how to join.',
    },
  ];
};

export async function loader() {
  const [users, allAlts] = await Promise.all([
    getUsersWithNicknames(),
    getAllUserAlts(),
  ]);
  const members = users.filter(user => user.nickname);
  // Members play across multiple accounts — the clan counts alts too
  const memberDiscordIds = new Set(members.map(user => user.discordId));
  const altCount = allAlts.filter(alt =>
    memberDiscordIds.has(alt.discordId),
  ).length;
  return json(
    { memberCount: members.length + altCount },
    { headers: { 'Cache-Control': 'max-age=300' } },
  );
}

const PVM_CONTENT = ['ToB / ToB HM', 'CoX / CoX CM', 'ToA', 'Nex'];

const COMMUNITY_EVENTS = [
  ['Weekly competitions', 'boss and skill challenges'],
  ['Bingo events', 'varied challenges and rewards'],
  ['Inter-clan events', 'compete with other clans'],
  ['Active Discord', 'cc chatter, raid pings, and event signups'],
] as const;

const listItemClass = `px-2 py-1 ${zebraStripeClass}`;

export default function AboutRoute() {
  const { memberCount } = useLoaderData<typeof loader>();

  return (
    <Container size="4" mt="3" pb="6">
      {/* Page title over a plain subtitle — the infobox carries the vitals,
          but this is the site's about page, not a wiki article */}
      <Box mt="2">
        <Heading size="8" className="font-normal text-sanguine-bright">
          About Sanguine
        </Heading>
        <Text as="p" size="3" className="mt-2 text-gray-400">
          A PvM and social Old School RuneScape clan
        </Text>
      </Box>

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:gap-8">
        <Infobox>
          <InfoboxBand primary>Sanguine</InfoboxBand>
          <Flex
            direction="column"
            align="center"
            gap="1"
            className="bg-sanguine-red/[0.04] px-3 py-5"
          >
            <img src="/sanguine_icon_small.png" alt="" width={56} height={56} />
            <Text size="2" className="text-gray-400">
              PvM & social clan
            </Text>
          </Flex>
          <dl>
            <InfoboxRow label="Clan chat" valueClassName="text-white">
              Sanguine PvM
            </InfoboxRow>
            <InfoboxRow label="Home world" valueClassName="text-white">
              479
            </InfoboxRow>
            <InfoboxRow label="Time zone">EST / PST</InfoboxRow>
            {memberCount > 0 && (
              <InfoboxRow label="Members" valueClassName="text-white">
                <Link to="/users" className={proseLinkClass}>
                  {memberCount}
                </Link>
              </InfoboxRow>
            )}
            <InfoboxRow label="Requirement">110+ combat</InfoboxRow>
            <InfoboxRow label="Discord">
              <a
                href="https://discord.gg/sanguine"
                target="_blank"
                rel="noopener noreferrer"
                className={proseLinkClass}
              >
                discord.gg/sanguine
              </a>
            </InfoboxRow>
          </dl>
        </Infobox>

        <Box className="min-w-0 flex-1">
          {/* Lede */}
          <Text as="p" size="3" className="mt-6 leading-7 text-gray-300">
            <strong className="font-medium text-white">Sanguine</strong> is a
            PvM and social Old School RuneScape clan,{' '}
            <Link to="/users" className={proseLinkClass}>
              <span className="font-semibold">{memberCount} members</span>
            </Link>{' '}
            strong. We raid the game&apos;s hardest content together, chase{' '}
            <Link to="/personal-bests" className={proseLinkClass}>
              clan records
            </Link>
            , and log our{' '}
            <Link to="/drops" className={proseLinkClass}>
              drops
            </Link>{' '}
            between{' '}
            <Link to="/events" className={proseLinkClass}>
              weekly competitions
            </Link>{' '}
            and bingo events.
          </Text>

          {/* What we offer */}
          <section className="mt-10">
            <SectionHeading title="What we offer" />
            <div className="mt-1 grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Box className="min-w-0">
                <SubsectionHeading title="Endgame PvM" />
                <ul>
                  {PVM_CONTENT.map(content => (
                    <li key={content} className={listItemClass}>
                      <Text size="3" className="text-gray-300">
                        {content}
                      </Text>
                    </li>
                  ))}
                </ul>
              </Box>
              <Box className="min-w-0">
                <SubsectionHeading title="Community events" />
                <ul>
                  {COMMUNITY_EVENTS.map(([name, detail]) => (
                    <li key={name} className={listItemClass}>
                      <Text size="3" className="text-gray-300">
                        <span className="text-white">{name}</span>
                        <span className="text-gray-400"> · {detail}</span>
                      </Text>
                    </li>
                  ))}
                </ul>
              </Box>
            </div>
          </section>

          {/* Requirements */}
          <section className="mt-10">
            <SectionHeading
              title="Requirements"
              summary={
                <Text size="2" className="text-gray-500">
                  what we look for
                </Text>
              }
            />
            <ul className="mt-3 max-w-2xl">
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  Combat level <span className="text-white">110+</span>
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  <span className="text-white">10 kc</span> in either ToB, CoX,
                  or ToA Expert
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  Be active in Discord
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  A respectful, mature attitude
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  An appetite for learning and improving
                </Text>
              </li>
            </ul>
          </section>

          {/* Benefits */}
          <section className="mt-10">
            <SectionHeading
              title="Benefits"
              summary={
                <Text size="2" className="text-gray-500">
                  what you get
                </Text>
              }
            />
            <ul className="mt-3 max-w-2xl">
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  The point-based reward system:{' '}
                  <span className="text-white">drop points</span> and{' '}
                  <span className="text-osrs-gold">clan points</span>
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  Progress tracking across the{' '}
                  <Link to="/drops" className={proseLinkClass}>
                    drop log
                  </Link>{' '}
                  and{' '}
                  <Link to="/personal-bests" className={proseLinkClass}>
                    personal-best boards
                  </Link>
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  Clanmates who&apos;ll teach you the harder raids
                </Text>
              </li>
              <li className={listItemClass}>
                <Text size="3" className="text-gray-300">
                  Socials, bingos, and inter-clan events
                </Text>
              </li>
            </ul>
          </section>

          {/* Join */}
          <section className="mt-10">
            <SectionHeading title="How to join" />
            <Text as="p" size="3" className="mt-3 leading-7 text-gray-300">
              Join the Discord and give the rules a read. When you&apos;re done,
              click the green checkmark in{' '}
              <span className="text-white">#welcome</span> and your application
              channel opens up; fill it out there and a staff member will take
              it from that point. In the meantime, come see who you&apos;ll be
              raiding with on the{' '}
              <Link to="/users" className={proseLinkClass}>
                members roster
              </Link>
              .
            </Text>
            <Box mt="4">
              <DiscordWidget />
            </Box>
          </section>
        </Box>
      </div>
    </Container>
  );
}
