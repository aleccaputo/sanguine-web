import { useNavigation } from '@remix-run/react';
import { useSpinDelay } from 'spin-delay';
import { Container, Flex, Box, Card, Grid } from '@radix-ui/themes';
import { useEffect } from 'react';

function RouteSkeletonLoader() {
  const transition = useNavigation();
  const busy = transition.state === 'loading';
  const delayedPending = useSpinDelay(busy, {
    delay: 200,
    minDuration: 400,
  });

  // Prevent body scroll when skeleton is visible
  useEffect(() => {
    if (delayedPending) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [delayedPending]);

  if (!delayedPending) return null;

  // Detect which route we're navigating to
  const targetPath = transition.location?.pathname || '';

  // Determine which skeleton to show
  const getSkeleton = () => {
    // Events detail page (e.g., /events/123)
    if (targetPath.match(/^\/events\/\d+$/)) {
      return <EventDetailSkeleton />;
    }

    // Events list page
    if (targetPath === '/events') {
      return <EventsListSkeleton />;
    }

    // Users detail page (e.g., /users/abc123)
    if (targetPath.match(/^\/users\/[\w-]+$/)) {
      return <UserDetailSkeleton />;
    }

    // Users list page
    if (targetPath === '/users') {
      return <UsersListSkeleton />;
    }

    // Drops page
    if (targetPath === '/drops') {
      return <DropsPageSkeleton />;
    }

    // Monthly winners page
    if (targetPath === '/monthly-winners') {
      return <MonthlyWinnersSkeleton />;
    }

    // Generic fallback for other pages
    return <GenericSkeleton />;
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#111113]">
      <div className="h-full overflow-y-auto pt-[73px]">{getSkeleton()}</div>
    </div>
  );
}

// Events Detail Page Skeleton (current page layout)
function EventDetailSkeleton() {
  return (
    <Container size="4" className="min-h-full py-8">
      <Flex direction="column" gap="6">
        {/* Chart Card */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-800/50"></div>
            <div className="h-80 animate-pulse rounded bg-gray-800/30"></div>
          </Box>
        </Card>

        {/* Spoons Card */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="4">
            <div className="mb-3 h-5 w-40 animate-pulse rounded bg-gray-800/50"></div>
            <Flex gap="3" className="grid grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg border border-gray-700"
                  ></div>
                ))}
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg border border-gray-700"
                  ></div>
                ))}
              </div>
            </Flex>
          </Box>
        </Card>

        {/* Leaderboard Card */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <div className="mb-4 h-5 w-56 animate-pulse rounded bg-gray-800/50"></div>
            <Flex direction="column" gap="3">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg border border-gray-700"
                ></div>
              ))}
            </Flex>
          </Box>
        </Card>
      </Flex>
    </Container>
  );
}

// Events List Page Skeleton
function EventsListSkeleton() {
  return (
    <Container size="4" className="min-h-full py-8">
      <Flex direction="column" gap="5">
        {/* Page Header */}
        <Box className="text-center">
          <div className="mx-auto h-8 w-64 animate-pulse rounded bg-gray-800/50"></div>
          <div className="mx-auto mt-2 h-1 w-32 animate-pulse bg-sanguine-red/30"></div>
        </Box>

        {/* Grid of Event Cards */}
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
          {[...Array(6)].map((_, idx) => (
            <Card
              key={idx}
              className="animate-pulse border border-gray-800 bg-gray-900"
            >
              <Flex p="4" gap="3" align="center">
                <div className="h-12 w-12 rounded-full bg-gray-700/50"></div>
                <Box className="flex-1">
                  <div className="mb-2 h-4 w-3/4 rounded bg-gray-700/50"></div>
                  <div className="h-3 w-1/2 rounded bg-gray-700/50"></div>
                </Box>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Flex>
    </Container>
  );
}

// Users List Page Skeleton — mirrors the roster: left-aligned header with the clan
// scythe, the two-column leader band, the search toolbar, then dense flat rows.
function UsersListSkeleton() {
  return (
    <Container size="3" className="min-h-full py-6">
      <Flex direction="column">
        {/* Page header */}
        <Box mb="6">
          <Flex align="center" gap="3">
            <div className="h-11 w-11 animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-9 w-48 animate-pulse rounded-sm bg-gray-800/50"></div>
          </Flex>
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
        </Box>

        {/* Leader band */}
        <Box
          mb="6"
          className="border-b border-t-2 border-gray-800 border-t-sanguine-red"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {[0, 1].map(col => (
              <div
                key={col}
                className={
                  col > 0
                    ? 'border-t border-gray-800 pb-2 sm:border-l sm:border-t-0 sm:pl-5'
                    : 'pb-2 sm:pr-5'
                }
              >
                <div className="mb-2 mt-2 h-3 w-24 animate-pulse rounded-sm bg-gray-800/50"></div>
                {[...Array(5)].map((_, idx) => (
                  <Flex key={idx} align="center" gap="3" className="py-1.5">
                    <div className="h-4 w-5 shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
                    <div className="h-[22px] w-[22px] shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
                    <div
                      className={`h-4 flex-1 animate-pulse rounded-sm bg-gray-800/50 ${idx === 0 ? 'h-5' : ''}`}
                    ></div>
                    <div className="h-4 w-10 animate-pulse rounded-sm bg-gray-800/50"></div>
                  </Flex>
                ))}
              </div>
            ))}
          </div>
        </Box>

        {/* Toolbar */}
        <Flex gap="2" align="center" className="mb-4">
          <div className="h-9 w-60 animate-pulse rounded-sm border border-gray-800 bg-gray-900"></div>
          <div className="h-9 w-28 animate-pulse rounded-sm border border-gray-800 bg-gray-900"></div>
        </Flex>

        {/* Roster rows */}
        <Box>
          {[...Array(12)].map((_, idx) => (
            <Flex
              key={idx}
              align="center"
              gap="3"
              className={`border-b border-gray-800 py-2.5 ${idx % 2 === 1 ? 'bg-sanguine-red/[0.05]' : ''}`}
            >
              <div className="h-4 w-6 shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
              <div className="h-[22px] w-[22px] shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-36 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
                <div className="h-3 w-20 animate-pulse rounded-sm bg-gray-800/40"></div>
              </div>
              <div className="hidden h-4 w-16 animate-pulse rounded-sm bg-gray-800/50 md:block"></div>
              <div className="h-4 w-10 animate-pulse rounded-sm bg-gray-800/50"></div>
              <div className="h-4 w-8 animate-pulse rounded-sm bg-gray-800/50"></div>
            </Flex>
          ))}
        </Box>
      </Flex>
    </Container>
  );
}

// User Detail Page Skeleton — mirrors the wiki article: title over a hairline,
// right-hand infobox with its red bands, prose lede, contents box, then a section.
function UserDetailSkeleton() {
  return (
    <Container size="4" className="min-h-full py-6">
      {/* Article title + tagline over a hairline */}
      <Box className="border-b border-gray-700 pb-2">
        <div className="h-10 w-64 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
        <div className="mt-2 h-4 w-52 animate-pulse rounded-sm bg-gray-800/40"></div>
      </Box>

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:gap-8">
        {/* Infobox */}
        <aside className="mt-6 w-full shrink-0 self-start border border-gray-700 lg:w-80">
          <div className="h-9 animate-pulse bg-sanguine-red/40"></div>
          <Flex align="center" justify="center" className="py-5">
            <div className="h-14 w-14 animate-pulse rounded-sm bg-gray-800/50"></div>
          </Flex>
          {[...Array(7)].map((_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2.5"
            >
              <div className="h-4 w-20 animate-pulse rounded-sm bg-gray-800/40"></div>
              <div className="h-4 w-24 animate-pulse rounded-sm bg-gray-800/50"></div>
            </div>
          ))}
        </aside>

        <Box className="min-w-0 flex-1">
          {/* Lede paragraph */}
          <div className="mt-6 space-y-2.5">
            <div className="h-4 w-full animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-4 w-full animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-4 w-11/12 animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-gray-800/50"></div>
          </div>

          {/* Contents box */}
          <div className="mt-6 w-56 border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-5 py-2">
              <div className="h-4 w-20 animate-pulse rounded-sm bg-gray-800/50"></div>
            </div>
            <div className="space-y-2 px-5 py-3">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-4 w-32 animate-pulse rounded-sm bg-gray-800/50"
                ></div>
              ))}
            </div>
          </div>

          {/* First section: underlined heading, then flat rows */}
          <div className="mt-10 flex items-baseline justify-between border-b border-gray-700 pb-1">
            <div className="h-6 w-28 animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-4 w-40 animate-pulse rounded-sm bg-gray-800/40"></div>
          </div>
          <Box mt="2">
            {[...Array(5)].map((_, idx) => (
              <Flex
                key={idx}
                align="center"
                gap="3"
                className={`px-2 py-3 ${idx % 2 === 1 ? 'bg-sanguine-red/[0.05]' : ''}`}
              >
                <div className="h-6 w-6 shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
                <div className="h-4 w-44 max-w-full flex-1 animate-pulse rounded-sm bg-gray-800/50"></div>
                <div className="space-y-1.5">
                  <div className="ml-auto h-4 w-20 animate-pulse rounded-sm bg-gray-800/50"></div>
                  <div className="ml-auto h-3 w-12 animate-pulse rounded-sm bg-gray-800/40"></div>
                </div>
              </Flex>
            ))}
          </Box>
        </Box>
      </div>
    </Container>
  );
}

// Drops Page Skeleton — mirrors the drop log: left-aligned header with the coins
// icon, a prose summary line, then flat zebra rows under the red rule.
function DropsPageSkeleton() {
  return (
    <Container size="3" className="min-h-full py-6">
      <Flex direction="column">
        {/* Page header */}
        <Box mb="6">
          <Flex align="center" gap="3">
            <div className="h-11 w-11 animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-9 w-44 animate-pulse rounded-sm bg-gray-800/50"></div>
          </Flex>
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
        </Box>

        {/* Drop log rows */}
        <Box className="border-t-2 border-t-sanguine-red">
          {[...Array(7)].map((_, idx) => (
            <Flex
              key={idx}
              align="center"
              gap="4"
              className={`border-b border-gray-800 px-2 py-3 ${idx % 2 === 1 ? 'bg-sanguine-red/[0.05]' : ''}`}
            >
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-44 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
                <div className="h-3 w-28 animate-pulse rounded-sm bg-gray-800/40"></div>
              </div>
              <div className="space-y-1.5">
                <div className="ml-auto h-3 w-20 animate-pulse rounded-sm bg-gray-800/50"></div>
                <div className="ml-auto h-3 w-14 animate-pulse rounded-sm bg-gray-800/40"></div>
                <div className="ml-auto h-3 w-12 animate-pulse rounded-sm bg-gray-800/40"></div>
              </div>
            </Flex>
          ))}
        </Box>
      </Flex>
    </Container>
  );
}

// Monthly Winners Skeleton — mirrors the champions page: left-aligned header,
// the three-column reigning band under the red rule, then three past-winner
// columns of zebra rows.
function MonthlyWinnersSkeleton() {
  return (
    <Container size="3" className="min-h-full py-6">
      <Flex direction="column">
        {/* Page header */}
        <Box mb="6">
          <Flex align="center" gap="3">
            <div className="h-11 w-11 animate-pulse rounded-sm bg-gray-800/50"></div>
            <div className="h-9 w-64 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
          </Flex>
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
        </Box>

        {/* Reigning champions band */}
        <Box
          mb="6"
          className="border-b border-t-2 border-gray-800 border-t-sanguine-red"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3">
            {[0, 1, 2].map(col => (
              <div
                key={col}
                className={
                  col > 0
                    ? 'border-t border-gray-800 pb-2 sm:border-l sm:border-t-0 sm:pl-5'
                    : 'pb-2 sm:pr-5'
                }
              >
                <div className="mb-3 mt-2 h-3 w-28 animate-pulse rounded-sm bg-gray-800/50"></div>
                <Flex align="center" gap="3">
                  <div className="h-[22px] w-[22px] shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
                  <div className="h-5 w-32 animate-pulse rounded-sm bg-gray-800/50"></div>
                </Flex>
                <div className="ml-9 mt-2 h-4 w-24 animate-pulse rounded-sm bg-gray-800/40"></div>
                <div className="ml-9 mt-2 h-3 w-36 max-w-full animate-pulse rounded-sm bg-gray-800/40"></div>
              </div>
            ))}
          </div>
        </Box>

        {/* Past winners columns */}
        <div className="mb-2 border-b border-gray-700 pb-1">
          <div className="h-5 w-32 animate-pulse rounded-sm bg-gray-800/50"></div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-5">
          {[0, 1, 2].map(col => (
            <Box key={col}>
              <div className="border-b border-gray-700 pb-1">
                <div className="h-4 w-28 animate-pulse rounded-sm bg-gray-800/50"></div>
              </div>
              {[...Array(4)].map((_, idx) => (
                <Flex
                  key={idx}
                  align="center"
                  gap="3"
                  className={`px-2 py-2 ${idx % 2 === 1 ? 'bg-sanguine-red/[0.05]' : ''}`}
                >
                  <div className="h-6 w-6 shrink-0 animate-pulse rounded-sm bg-gray-800/50"></div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3.5 w-24 animate-pulse rounded-sm bg-gray-800/50"></div>
                    <div className="h-3 w-20 animate-pulse rounded-sm bg-gray-800/40"></div>
                  </div>
                  <div className="h-3 w-14 animate-pulse rounded-sm bg-gray-800/40"></div>
                </Flex>
              ))}
            </Box>
          ))}
        </div>
      </Flex>
    </Container>
  );
}

// Generic Skeleton for unknown routes
function GenericSkeleton() {
  return (
    <Container size="4" className="min-h-full py-8">
      <Flex direction="column" gap="6">
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-800/50"></div>
            <div className="h-64 animate-pulse rounded bg-gray-800/30"></div>
          </Box>
        </Card>
      </Flex>
    </Container>
  );
}

export { RouteSkeletonLoader };
