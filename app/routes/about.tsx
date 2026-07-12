import { json, MetaFunction } from '@remix-run/node';
import { Container, Text, Box, Flex } from '@radix-ui/themes';
import { Link, useLoaderData } from '@remix-run/react';
import { DiscordWidget } from '~/components/DiscordWidget';
import { ArticleTitle } from '~/components/ArticleTitle';
import { CategoriesFooter } from '~/components/CategoriesFooter';
import { ContentsBox } from '~/components/ContentsBox';
import { Infobox, InfoboxBand, InfoboxRow } from '~/components/Infobox';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { proseLinkClass } from '~/utils/styles';

export const meta: MetaFunction = () => {
  return [
    { title: 'About Sanguine' },
    {
      name: 'description',
      content: 'Learn about Sanguine - A Premier OSRS PvM and Social Clan',
    },
  ];
};

export async function loader() {
  const users = await getUsersWithNicknames();
  return json(
    { memberCount: users.filter(user => user.nickname).length },
    { headers: { 'Cache-Control': 'max-age=300' } },
  );
}

const PVM_CONTENT = ['ToB / ToB HM', 'CoX / CoX CM', 'ToA', 'Yama & Nex'];

const COMMUNITY_EVENTS = [
  ['Weekly competitions', 'boss and skill challenges'],
  ['Bingo events', 'varied challenges and rewards'],
  ['Inter-clan events', 'compete with other clans'],
  ['Active Discord', 'community chat and coordination'],
] as const;

const REQUIREMENTS = [
  'Combat level 110+',
  '10 kc in either ToB, CoX, or ToA Expert',
  'Active Discord participation',
  'Respectful and mature attitude',
  'Interest in learning and improving',
];

const BENEFITS = [
  'Point-based reward system',
  'Progress tracking and leaderboards',
  'Expert mentorship and guidance',
  'Social events and community activities',
];

const SECTIONS = [
  { id: 'what-we-offer', title: 'What we offer' },
  { id: 'requirements', title: 'Requirements' },
  { id: 'benefits', title: 'Benefits' },
  { id: 'join', title: 'How to join' },
];

export default function AboutRoute() {
  const { memberCount } = useLoaderData<typeof loader>();

  return (
    <Container size="4" mt="3" pb="6">
      {/* The clan's own wiki article: title, infobox of vitals, lede, sections */}
      <ArticleTitle title="Sanguine" />

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:gap-8">
        <Infobox>
          <InfoboxBand primary>Sanguine</InfoboxBand>
          <Flex
            direction="column"
            align="center"
            gap="1"
            className="bg-sanguine-red/[0.04] px-3 py-5"
          >
            <img
              src="/sanguine_icon_small.png"
              alt=""
              width={56}
              height={56}
            />
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
            PvM and social Old School RuneScape clan dedicated to excellence,
            community, and helping members achieve their goals. Its{' '}
            <Link to="/users" className={proseLinkClass}>
              <span className="font-semibold">{memberCount} members</span>
            </Link>{' '}
            raid together across the game&apos;s endgame content, chase{' '}
            <Link to="/personal-bests" className={proseLinkClass}>
              clan records
            </Link>
            , and fill the{' '}
            <Link to="/drops" className={proseLinkClass}>
              drop log
            </Link>{' '}
            between{' '}
            <Link to="/events" className={proseLinkClass}>
              weekly competitions
            </Link>{' '}
            and bingo events.
          </Text>

          <ContentsBox sections={SECTIONS} />

          {/* What we offer */}
          <section id="what-we-offer" className="mt-10 scroll-mt-20">
            <SectionHeading title="What we offer" />
            <div className="mt-1 grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Box className="min-w-0">
                <SubsectionHeading title="Elite PvM content" />
                <ul className="space-y-2">
                  {PVM_CONTENT.map(content => (
                    <li key={content}>
                      <Text size="3" className="text-gray-300">
                        {content}
                      </Text>
                    </li>
                  ))}
                </ul>
              </Box>
              <Box className="min-w-0">
                <SubsectionHeading title="Community events" />
                <ul className="space-y-2">
                  {COMMUNITY_EVENTS.map(([name, detail]) => (
                    <li key={name}>
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
          <section id="requirements" className="mt-10 scroll-mt-20">
            <SectionHeading
              title="Requirements"
              summary={
                <Text size="2" className="text-gray-500">
                  what we look for
                </Text>
              }
            />
            <ul className="mt-3 space-y-2">
              {REQUIREMENTS.map(requirement => (
                <li key={requirement}>
                  <Text size="3" className="text-gray-300">
                    {requirement}
                  </Text>
                </li>
              ))}
            </ul>
          </section>

          {/* Benefits */}
          <section id="benefits" className="mt-10 scroll-mt-20">
            <SectionHeading
              title="Benefits"
              summary={
                <Text size="2" className="text-gray-500">
                  what you get
                </Text>
              }
            />
            <ul className="mt-3 space-y-2">
              {BENEFITS.map(benefit => (
                <li key={benefit}>
                  <Text size="3" className="text-gray-300">
                    {benefit}
                  </Text>
                </li>
              ))}
            </ul>
          </section>

          {/* Join */}
          <section id="join" className="mt-10 scroll-mt-20">
            <SectionHeading title="How to join" />
            <Text as="p" size="3" className="mt-3 leading-7 text-gray-300">
              Introduce yourself on Discord and a staff member will get you
              ranked in the clan chat. Come see who you&apos;ll be raiding with
              on the{' '}
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

      <CategoriesFooter
        to="/users"
        primaryLabel="Sanguine members"
        categories={['PvM clans', 'Social clans']}
      />
    </Container>
  );
}
