import { Text, Container, Box, Flex } from '@radix-ui/themes';
import { defer, MetaFunction } from '@remix-run/node';
import {
  getCompetitionById,
  getCompetitions,
} from '~/services/wom-api-service.server';
import { Await, Outlet, useLoaderData, useNavigate } from '@remix-run/react';
import { Suspense, useState } from 'react';
import { getCompetitionImageUrl } from '~/utils/competition-images';
import { SPECIAL_COMPETITION_IDS } from '~/utils/events-config';
import { PageHeader } from '~/components/PageHeader';
import { Pagination } from '~/components/Pagination';
import { EmptyState } from '~/components/EmptyState';
import { zebraRowClass } from '~/utils/styles';

export const meta: MetaFunction = () => {
  return [
    { title: 'Events' },
    { name: 'description', content: 'Recent Events for Sanguine' },
  ];
};

const rowGridClass =
  'grid grid-cols-[28px_1fr_88px] items-center gap-2 px-2 sm:grid-cols-[28px_1fr_88px_11rem] md:grid-cols-[32px_1fr_88px_12rem_64px] md:gap-3 md:px-3';

const SkeletonLoader = () => (
  <Box className="border-t-2 border-t-sanguine-red">
    <Text as="p" size="2" className="py-2 text-gray-500">
      Loading events... This may take up to a minute.
    </Text>
    {[...Array(8).keys()].map(idx => (
      <div
        key={idx}
        className={`${rowGridClass} border-b border-gray-800 py-2.5 ${
          idx % 2 === 1 ? 'bg-sanguine-red/[0.05]' : ''
        }`}
      >
        <div className="h-7 w-7 animate-pulse rounded-sm bg-gray-800/50"></div>
        <div className="h-4 w-56 max-w-full animate-pulse rounded-sm bg-gray-800/50"></div>
        <div className="h-4 w-16 animate-pulse rounded-sm bg-gray-800/40"></div>
        <div className="hidden h-4 w-36 animate-pulse rounded-sm bg-gray-800/40 sm:block"></div>
        <div className="hidden h-4 w-8 animate-pulse justify-self-end rounded-sm bg-gray-800/40 md:block"></div>
      </div>
    ))}
  </Box>
);

export async function loader() {
  const womCompsPromise = getCompetitions();
  const [lead, ...rest] = await Promise.all(
    SPECIAL_COMPETITION_IDS.map(id => getCompetitionById(id)),
  );

  const competitionsPromise = womCompsPromise.then(womComps => [
    lead,
    ...(womComps ?? []),
    ...rest,
  ]);

  return defer(
    {
      competitions: competitionsPromise,
    },
    {
      headers: {
        'Cache-Control': 'max-age=3600',
      },
    },
  );
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// Status stays inside the palette: active reads friends-list green, upcoming
// plain white, completed muted.
const getEventStatus = (startsAt: string, endsAt: string) => {
  const now = new Date();
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (now < start) return { status: 'Upcoming', color: 'text-gray-200' };
  if (now > end) return { status: 'Completed', color: 'text-gray-500' };
  return { status: 'Active', color: 'text-green-400' };
};

const Events = () => {
  const { competitions } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  return (
    <Container size="3" mt="3">
      <Flex direction="column">
        <PageHeader title="Events" iconSrc="/sanguine_icon_small.png">
          <Suspense fallback={<>Recent competitions and clan events</>}>
            <Await resolve={competitions}>
              {competitions => {
                const all = competitions ?? [];
                const active = all.filter(
                  comp =>
                    getEventStatus(comp.startsAt, comp.endsAt).status ===
                    'Active',
                ).length;
                return (
                  <>
                    <span className="font-semibold text-white">
                      {all.length}
                    </span>{' '}
                    competitions on the books
                    {active > 0 && (
                      <>
                        , <span className="text-green-400">{active}</span>{' '}
                        running now
                      </>
                    )}
                  </>
                );
              }}
            </Await>
          </Suspense>
        </PageHeader>

        <Suspense fallback={<SkeletonLoader />}>
          <Await resolve={competitions}>
            {competitions => {
              const allCompetitions = competitions ?? [];

              const totalItems = allCompetitions.length;
              const totalPages = Math.ceil(totalItems / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const currentItems = allCompetitions.slice(
                startIndex,
                startIndex + itemsPerPage,
              );

              return (
                <>
                  {/* Column headers over the red rule, hiscores-style */}
                  <div
                    className={`${rowGridClass} border-b border-t-2 border-gray-700 border-t-sanguine-red py-2.5 text-sm text-osrs-orange`}
                  >
                    <span></span>
                    <span>Competition</span>
                    <span>Status</span>
                    <span className="hidden sm:block">Dates</span>
                    <span className="hidden text-right md:block">Players</span>
                  </div>

                  {currentItems.length === 0 ? (
                    <EmptyState />
                  ) : (
                    currentItems.map(comp => {
                      const eventStatus = getEventStatus(
                        comp.startsAt,
                        comp.endsAt,
                      );
                      return (
                        <div
                          key={comp.id}
                          onClick={() => navigate(`/events/${comp.id}`)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              navigate(`/events/${comp.id}`);
                            }
                          }}
                          role="link"
                          tabIndex={0}
                          className={`${rowGridClass} group cursor-pointer py-2.5 ${zebraRowClass}`}
                        >
                          <img
                            src={getCompetitionImageUrl(comp.metric)}
                            alt=""
                            className="h-7 w-7 shrink-0 object-contain"
                          />
                          <Text
                            as="div"
                            className="min-w-0 truncate leading-tight text-sanguine-bright group-hover:text-white"
                          >
                            {comp.title}
                          </Text>
                          <Text as="div" size="2" className={eventStatus.color}>
                            {eventStatus.status}
                          </Text>
                          <Text
                            as="div"
                            size="2"
                            className="hidden text-gray-400 sm:block"
                          >
                            {/* Break only between start and end, never inside a date */}
                            <span className="whitespace-nowrap">
                              {formatDate(comp.startsAt)} –
                            </span>{' '}
                            <span className="whitespace-nowrap">
                              {formatDate(comp.endsAt)}
                            </span>
                          </Text>
                          <Text
                            as="div"
                            size="2"
                            className={`hidden text-right md:block ${
                              comp.participantCount > 0
                                ? 'text-white'
                                : 'text-gray-600'
                            }`}
                          >
                            {comp.participantCount > 0
                              ? comp.participantCount
                              : '—'}
                          </Text>
                        </div>
                      );
                    })
                  )}

                  <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPrev={() => setCurrentPage(page => Math.max(1, page - 1))}
                    onNext={() =>
                      setCurrentPage(page => Math.min(totalPages, page + 1))
                    }
                  />

                  <Text
                    as="p"
                    size="1"
                    className="mt-4 border-t border-gray-800 py-3 text-gray-600"
                  >
                    {totalItems} events
                  </Text>
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
