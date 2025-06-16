import { MetaFunction } from '@remix-run/node';
import {
  Container,
  Heading,
  Text,
  Box,
  Flex,
  Card,
  Grid,
  Button,
} from '@radix-ui/themes';
import { Link } from '@remix-run/react';
import { DiscordWidget } from '~/components/DiscordWidget';

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

export default function Index() {
  return (
    <Container size="4">
      {/* Hero Section */}
      <Box className="py-16 text-center">
        <Heading size="9" className="mb-4 text-sanguine-red">
          Welcome to Sanguine
        </Heading>
        <Box className="mx-auto mb-6 h-1 w-48 bg-sanguine-red"></Box>
        <Text size="5" className="mx-auto mb-8 max-w-2xl text-gray-300">
          PvM, bossing, raiding and skilling events with an active community
        </Text>

        <Grid
          columns={{ initial: '2', sm: '4' }}
          gap="4"
          className="mx-auto mb-8 max-w-2xl"
        >
          <Box className="text-center">
            <Text size="2" className="block text-gray-400">
              In-Game CC
            </Text>
            <Text size="3" className="font-medium text-sanguine-red">
              Sanguine PvM
            </Text>
          </Box>
          <Box className="text-center">
            <Text size="2" className="block text-gray-400">
              Home World
            </Text>
            <Text size="3" className="font-medium text-sanguine-red">
              479
            </Text>
          </Box>
          <Box className="text-center">
            <Text size="2" className="block text-gray-400">
              Time Zone
            </Text>
            <Text size="3" className="font-medium text-sanguine-red">
              EST/PST
            </Text>
          </Box>
          <Box className="text-center">
            <Text size="2" className="block text-gray-400">
              Members
            </Text>
            <Text size="3" className="font-medium text-sanguine-red">
              170+
            </Text>
          </Box>
        </Grid>

        <img
          src="/SanguinePersonalBanner.png"
          alt="Sanguine Banner"
          className="mx-auto h-auto max-w-full rounded-lg shadow-lg"
        />
      </Box>

      {/* Features Grid */}
      <Grid
        columns={{ initial: '1', sm: '2', md: '3' }}
        gap="6"
        className="mb-16"
      >
        <Card className="border border-gray-800 bg-gray-900 p-6 text-center">
          <Heading size="4" className="mb-3 text-sanguine-red">
            Elite PvM
          </Heading>
          <Text size="3" className="text-gray-400">
            ToB/ToB HM, CoX/CoX CM, ToA, Yama, Nex and more
          </Text>
        </Card>

        <Card className="border border-gray-800 bg-gray-900 p-6 text-center">
          <Heading size="4" className="mb-3 text-sanguine-red">
            Active Community
          </Heading>
          <Text size="3" className="text-gray-400">
            Dedicated OSRS players working together
          </Text>
        </Card>

        <Card className="border border-gray-800 bg-gray-900 p-6 text-center">
          <Heading size="4" className="mb-3 text-sanguine-red">
            Competitions
          </Heading>
          <Text size="3" className="text-gray-400">
            Weekly challenges, bingo events, and skill competitions
          </Text>
        </Card>
      </Grid>

      {/* Join Community Section */}
      <Card className="mb-16 border border-gray-800 bg-gray-900">
        <Box p="8" className="text-center">
          <Heading size="6" className="mb-6 text-white">
            Join Our Community
          </Heading>

          <Grid columns={{ initial: '1', sm: '3' }} gap="6" className="mb-8">
            <Box>
              <Text size="7" className="block font-bold text-sanguine-red">
                170+
              </Text>
              <Text size="3" className="text-gray-400">
                Active Members
              </Text>
            </Box>
            <Box>
              <Text size="7" className="block font-bold text-sanguine-red">
                110+
              </Text>
              <Text size="3" className="text-gray-400">
                Combat Level Required
              </Text>
            </Box>
            <Box>
              <Text size="7" className="block font-bold text-sanguine-red">
                24/7
              </Text>
              <Text size="3" className="text-gray-400">
                Discord Activity
              </Text>
            </Box>
          </Grid>

          <DiscordWidget
            title="Ready to Join?"
            description="Connect with our community on Discord and start your journey"
            showButtons={false}
          />
        </Box>
      </Card>

      {/* Call to Action */}
      <Box className="pb-16 text-center">
        <Text size="4" className="mb-6 text-gray-400">
          Explore our members, check out recent events, or learn more about the
          clan
        </Text>
        <Flex gap="4" justify="center" wrap="wrap">
          <Link to="/users">
            <Button
              size="3"
              variant="outline"
              color="gray"
              className="transition-colors hover:cursor-pointer hover:border-sanguine-red hover:bg-sanguine-red hover:text-white"
            >
              View Members
            </Button>
          </Link>
          <Link to="/events">
            <Button
              size="3"
              variant="outline"
              color="gray"
              className="transition-colors hover:cursor-pointer hover:border-sanguine-red hover:bg-sanguine-red hover:text-white"
            >
              Recent Events
            </Button>
          </Link>
          <Link to="/about">
            <Button
              size="3"
              variant="outline"
              color="gray"
              className="transition-colors hover:cursor-pointer hover:border-sanguine-red hover:bg-sanguine-red hover:text-white"
            >
              Learn More
            </Button>
          </Link>
        </Flex>
      </Box>
    </Container>
  );
}
