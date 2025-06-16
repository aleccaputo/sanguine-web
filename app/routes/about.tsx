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
    { title: 'About Sanguine' },
    {
      name: 'description',
      content: 'Learn about Sanguine - A Premier OSRS PvM and Social Clan',
    },
  ];
};

export default function AboutRoute() {
  return (
    <Container size="4" mt="3">
      <Flex direction="column" gap="8">
        {/* Header */}
        <Box className="text-center">
          <Heading size="8" className="mb-4 text-sanguine-red">
            About Sanguine
          </Heading>
          <Box className="mx-auto mb-6 h-1 w-32 bg-sanguine-red"></Box>
          <Text size="5" className="mx-auto max-w-3xl text-gray-300">
            We are a PvM and Social Old School RuneScape clan dedicated to
            excellence, community, and helping members achieve their goals.
          </Text>
        </Box>

        {/* What We Offer */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="8">
            <Heading size="6" className="mb-6 text-center text-white">
              What We Offer
            </Heading>

            <Grid columns={{ initial: '1', md: '2' }} gap="6">
              {/* PvM Activities */}
              <Box>
                <Heading size="4" className="mb-4 text-sanguine-red">
                  Elite PvM Content
                </Heading>
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>ToB/ToB HM</strong>
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>CoX/CoX CM</strong>
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>ToA</strong>
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>Yama & Nex</strong>
                    </Text>
                  </Flex>
                </Flex>
              </Box>

              {/* Community Activities */}
              <Box>
                <Heading size="4" className="mb-4 text-sanguine-red">
                  Community Events
                </Heading>
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>Weekly Competitions</strong> - Boss and skill
                      challenges
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>Bingo Events</strong> - Varied challenges and
                      rewards
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>Inter-Clan Events</strong> - Compete with other
                      clans
                    </Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text className="text-sanguine-red">•</Text>
                    <Text size="3" className="text-gray-300">
                      <strong>Active Discord</strong> - Community chat and
                      coordination
                    </Text>
                  </Flex>
                </Flex>
              </Box>
            </Grid>
          </Box>
        </Card>

        {/* Requirements */}
        <Grid columns={{ initial: '1', md: '2' }} gap="6">
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="6">
              <Heading size="5" className="mb-4 text-white">
                Requirements
              </Heading>
              <Flex direction="column" gap="3">
                <Flex align="center" gap="3">
                  <Text className="text-green-400">✓</Text>
                  <Text size="3" className="text-gray-300">
                    Combat level 110+
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  <Text className="text-green-400">✓</Text>
                  <Text size="3" className="text-gray-300">
                    Active Discord participation
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  <Text className="text-green-400">✓</Text>
                  <Text size="3" className="text-gray-300">
                    Respectful and mature attitude
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  <Text className="text-green-400">✓</Text>
                  <Text size="3" className="text-gray-300">
                    Interest in learning and improving
                  </Text>
                </Flex>
              </Flex>
            </Box>
          </Card>

          <Card className="border border-gray-800 bg-gray-900">
            <Box p="6">
              <Heading size="5" className="mb-4 text-white">
                Clan Benefits
              </Heading>
              <Flex direction="column" gap="3">
                <Flex align="center" gap="3">
                  <Text className="text-sanguine-red">•</Text>
                  <Text size="3" className="text-gray-300">
                    Point-based reward system
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  <Text className="text-sanguine-red">•</Text>
                  <Text size="3" className="text-gray-300">
                    Progress tracking and leaderboards
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  <Text className="text-sanguine-red">•</Text>
                  <Text size="3" className="text-gray-300">
                    Expert mentorship and guidance
                  </Text>
                </Flex>
                <Flex align="center" gap="3">
                  <Text className="text-sanguine-red">•</Text>
                  <Text size="3" className="text-gray-300">
                    Social events and community activities
                  </Text>
                </Flex>
              </Flex>
            </Box>
          </Card>
        </Grid>

        {/* Discord Section */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="8">
            <DiscordWidget />

            <Flex gap="4" wrap="wrap" justify="center" mt="4">
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
            </Flex>
          </Box>
        </Card>
      </Flex>
    </Container>
  );
}
