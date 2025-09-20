import {
  Avatar,
  Card,
  Text,
  Container,
  Grid,
  Heading,
  Box,
  Flex,
  Button,
  IconButton,
} from '@radix-ui/themes';
import { json, MetaFunction } from '@remix-run/node';
import {
  getCompetitionById,
  getCompetitions,
} from '~/services/wom-api-service.server';
import { Await, Outlet, useLoaderData, useNavigate } from '@remix-run/react';
import { Suspense, useState } from 'react';
import { getCompetitionImageUrl } from '~/utils/competition-images';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

export const meta: MetaFunction = () => {
  return [
    { title: 'Events' },
    { name: 'description', content: 'Recent Events for Sanguine' },
  ];
};

const SkeletonLoader = () => (
  <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
    {[...Array(6).keys()].map((_, idx) => (
      <Card
        key={idx}
        className="animate-pulse border border-gray-800 bg-gray-900"
      >
        <Flex p="4" gap="3" align="center">
          <div className="h-12 w-12 rounded-full bg-gray-700"></div>
          <Box className="flex-1">
            <div className="mb-2 h-4 w-3/4 rounded bg-gray-700"></div>
            <div className="h-3 w-1/2 rounded bg-gray-700"></div>
          </Box>
        </Flex>
      </Card>
    ))}
  </Grid>
);

export async function loader() {
  const womCompsPromise = getCompetitions();
  const fall2025BingoPromise = getCompetitionById(107621);
  const rngBingoPromise = getCompetitionById(46594);
  const starBingoPromise = getCompetitionById(79514);
  const coalitionBingoPromise = getCompetitionById(101103);

  const [fall2025Bingo, womComps, rngBingo, starBingo, coalitionBingo] =
    await Promise.all([
      fall2025BingoPromise,
      womCompsPromise,
      rngBingoPromise,
      starBingoPromise,
      coalitionBingoPromise,
    ]);
  return json(
    {
      competitions: [
        fall2025Bingo,
        ...(womComps ?? []),
        coalitionBingo,
        starBingo,
        rngBingo,
      ],
    },
    {
      headers: {
        'Cache-Control': 'max-age=3600',
      },
      status: 200,
    },
  );
}
const Events = () => {
  const { competitions } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getEventStatus = (startsAt: string, endsAt: string) => {
    const now = new Date();
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (now < start) return { status: 'Upcoming', color: 'text-blue-400' };
    if (now > end) return { status: 'Completed', color: 'text-gray-400' };
    return { status: 'Active', color: 'text-green-400' };
  };

  return (
    <Container size="4" mt="3">
      <Flex direction="column" gap="5">
        <Box className="text-center">
          <Heading size="6" className="tracking-wide text-sanguine-red">
            Sanguine Events
          </Heading>
          <Box className="mx-auto mt-2 h-1 w-32 bg-sanguine-red"></Box>
          <Text size="3" className="mt-3 text-gray-400">
            Recent competitions and clan events
          </Text>
        </Box>

        <Suspense fallback={<SkeletonLoader />}>
          <Await resolve={competitions}>
            {competitions => {
              // Filter competitions that have started
              const startedCompetitions =
                competitions?.filter(
                  x => x.startsAt < new Date().toISOString(),
                ) ?? [];

              // Calculate pagination
              const totalItems = startedCompetitions.length;
              const totalPages = Math.ceil(totalItems / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentItems = startedCompetitions.slice(
                startIndex,
                endIndex,
              );

              return (
                <>
                  <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
                    {currentItems.map(comp => {
                      const eventStatus = getEventStatus(
                        comp.startsAt,
                        comp.endsAt,
                      );
                      return (
                        <Card
                          key={comp.id}
                          className="border border-gray-800 bg-gray-900 transition-all duration-200 hover:border-sanguine-red hover:shadow-lg hover:shadow-sanguine-red/20"
                        >
                          <Box
                            p="4"
                            className="cursor-pointer"
                            onClick={() => navigate(`/events/${comp.id}`)}
                          >
                            <Flex gap="3" align="center" mb="3">
                              <Avatar
                                size="3"
                                src={getCompetitionImageUrl(comp.metric)}
                                radius="full"
                                fallback="S"
                              />
                              <Text
                                as="div"
                                size="4"
                                className="font-bold text-sanguine-red"
                              >
                                {comp.title}
                              </Text>
                            </Flex>

                            <Flex direction="column" gap="1">
                              <Flex justify="between">
                                <Text size="2" className="text-gray-400">
                                  Status:
                                </Text>
                                <Text size="2" className={eventStatus.color}>
                                  {eventStatus.status}
                                </Text>
                              </Flex>

                              <Flex justify="between">
                                <Text size="2" className="text-gray-400">
                                  Started:
                                </Text>
                                <Text size="2" className="text-white">
                                  {formatDate(comp.startsAt)}
                                </Text>
                              </Flex>

                              <Flex justify="between">
                                <Text size="2" className="text-gray-400">
                                  Ends:
                                </Text>
                                <Text size="2" className="text-white">
                                  {formatDate(comp.endsAt)}
                                </Text>
                              </Flex>

                              {comp.participantCount > 0 && (
                                <Flex justify="between">
                                  <Text size="2" className="text-gray-400">
                                    Participants:
                                  </Text>
                                  <Text size="2" className="text-sanguine-red">
                                    {comp.participantCount}
                                  </Text>
                                </Flex>
                              )}
                            </Flex>
                          </Box>
                        </Card>
                      );
                    })}
                  </Grid>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <Flex justify="center" align="center" gap="3" mt="6">
                      <IconButton
                        variant="ghost"
                        color="gray"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        <ChevronLeftIcon width="16" height="16" />
                      </IconButton>

                      <Flex gap="2" align="center">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1,
                        ).map(pageNum => (
                          <Button
                            key={pageNum}
                            variant={
                              pageNum === currentPage ? 'solid' : 'ghost'
                            }
                            color={pageNum === currentPage ? 'red' : 'gray'}
                            size="2"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        ))}
                      </Flex>

                      <IconButton
                        variant="ghost"
                        color="gray"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        <ChevronRightIcon width="16" height="16" />
                      </IconButton>
                    </Flex>
                  )}

                  <Box mt="4" className="text-center">
                    <Text size="2" className="text-gray-400">
                      Showing {startIndex + 1}-{Math.min(endIndex, totalItems)}{' '}
                      of {totalItems} events
                    </Text>
                  </Box>
                </>
              );
            }}
          </Await>
        </Suspense>
      </Flex>
      <Outlet />
    </Container>
  );
};

export default Events;
