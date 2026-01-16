import { useNavigation } from '@remix-run/react';
import { useSpinDelay } from 'spin-delay';
import { Container, Flex, Box, Card } from '@radix-ui/themes';

function SkeletonLoader() {
  const transition = useNavigation();
  const busy = transition.state === 'loading';
  const delayedPending = useSpinDelay(busy, {
    delay: 200,
    minDuration: 400,
  });

  if (!delayedPending) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[73px] z-40 overflow-y-auto bg-[#111113]">
      <Container size="4" className="py-8">
        <Flex direction="column" gap="6">
          {/* Main Content Card */}
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-800/50"></div>
              <div className="h-80 animate-pulse rounded bg-gray-800/30"></div>
            </Box>
          </Card>

          {/* Secondary Card */}
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="4">
              <div className="mb-3 h-5 w-40 animate-pulse rounded bg-gray-800/50"></div>
              <Flex gap="3" className="grid grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg border border-gray-700 bg-transparent"
                    ></div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg border border-gray-700 bg-transparent"
                    ></div>
                  ))}
                </div>
              </Flex>
            </Box>
          </Card>

          {/* List Card */}
          <Card className="border border-gray-800 bg-gray-900">
            <Box p="5">
              <div className="mb-4 h-5 w-56 animate-pulse rounded bg-gray-800/50"></div>
              <Flex direction="column" gap="3">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-lg border border-gray-700 bg-transparent"
                  ></div>
                ))}
              </Flex>
            </Box>
          </Card>
        </Flex>
      </Container>
    </div>
  );
}

export { SkeletonLoader };
