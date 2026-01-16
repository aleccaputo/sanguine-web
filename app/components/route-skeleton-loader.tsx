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

    // Generic fallback for other pages
    return <GenericSkeleton />;
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#111113]">
      <div className="h-full overflow-y-auto pt-[73px]">
        {getSkeleton()}
      </div>
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

// Users List Page Skeleton
function UsersListSkeleton() {
  return (
    <Container size="4" className="min-h-full py-8">
      <Flex direction="column" gap="5">
        {/* Page Header */}
        <Box className="text-center">
          <div className="mx-auto h-8 w-64 animate-pulse rounded bg-gray-800/50"></div>
          <div className="mx-auto mt-2 h-1 w-32 animate-pulse bg-sanguine-red/30"></div>
        </Box>

        {/* Search Bar */}
        <div className="mx-auto h-10 w-full max-w-md animate-pulse rounded border border-gray-800 bg-gray-900"></div>

        {/* Grid of Member Cards */}
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
          {[...Array(9)].map((_, idx) => (
            <Card
              key={idx}
              className="animate-pulse border border-gray-800 bg-gray-900"
            >
              <Box p="4">
                <div className="mb-3 h-5 w-2/3 rounded bg-gray-700/50"></div>
                <div className="h-4 w-1/2 rounded bg-gray-700/50"></div>
              </Box>
            </Card>
          ))}
        </Grid>
      </Flex>
    </Container>
  );
}

// User Detail Page Skeleton
function UserDetailSkeleton() {
  return (
    <Container size="4" className="min-h-full py-8">
      <Flex direction="column" gap="6">
        {/* User Header Card */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Flex gap="4" align="center" className="mb-4">
              <div className="h-20 w-20 animate-pulse rounded-full bg-gray-700/50"></div>
              <div className="flex-1 space-y-2">
                <div className="h-8 w-48 animate-pulse rounded bg-gray-700/50"></div>
                <div className="h-4 w-32 animate-pulse rounded bg-gray-700/50"></div>
              </div>
            </Flex>
            <Flex gap="4">
              <div className="h-12 w-24 animate-pulse rounded bg-gray-700/50"></div>
              <div className="h-12 w-24 animate-pulse rounded bg-gray-700/50"></div>
              <div className="h-12 w-24 animate-pulse rounded bg-gray-700/50"></div>
            </Flex>
          </Box>
        </Card>

        {/* Stats Cards */}
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
          {[1, 2].map(i => (
            <Card key={i} className="border border-gray-800 bg-gray-900">
              <Box p="5">
                <div className="mb-4 h-5 w-32 animate-pulse rounded bg-gray-700/50"></div>
                <div className="space-y-2">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="h-8 animate-pulse rounded bg-gray-700/30"></div>
                  ))}
                </div>
              </Box>
            </Card>
          ))}
        </Grid>
      </Flex>
    </Container>
  );
}

// Drops Page Skeleton
function DropsPageSkeleton() {
  return (
    <Container size="4" className="min-h-full py-8">
      <Flex direction="column" gap="5">
        {/* Page Header */}
        <Box className="text-center">
          <div className="mx-auto h-8 w-64 animate-pulse rounded bg-gray-800/50"></div>
          <div className="mx-auto mt-2 h-1 w-32 animate-pulse bg-sanguine-red/30"></div>
        </Box>

        {/* Drops List */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Flex direction="column" gap="3">
              {[...Array(8)].map((_, idx) => (
                <div
                  key={idx}
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
