import * as React from 'react';
import { Avatar, Card, Text } from '@radix-ui/themes';
import { json, MetaFunction } from '@remix-run/node';
import {
  getCompetitionById,
  getCompetitions,
} from '~/services/wom-api-service.server';
import { Await, Outlet, useLoaderData, useNavigate } from '@remix-run/react';
import SanguineLogo from '../../other/svg-icons/SanguineIcon.svg';
import { Suspense } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Events' },
    { name: 'description', content: 'Recent Events for Sanguine' },
  ];
};

const SkeletonLoader = () =>
  [...Array(10).keys()].map((_, idx) => (
    <div className={'basis-1/4'} key={idx}>
      <Card style={{ maxWidth: 240 }} className={'cursor-pointer'}>
        <div className={'flex flex-col content-center'}>
          <Avatar size={'3'} radius={'full'} fallback="S" />
          <div
            className={
              'mb-4 h-2.5 w-48 rounded-full bg-gray-200 dark:bg-gray-700'
            }
          ></div>
          <div
            className={
              'mb-4 h-2.5 w-48 rounded-full bg-gray-200 dark:bg-gray-700'
            }
          ></div>
        </div>
      </Card>
    </div>
  ));

export async function loader() {
  const womCompsPromise = getCompetitions();
  const rngBingoPromise = getCompetitionById(46594);
  const starBingoPromise = getCompetitionById(79514);

  const [womComps, rngBingo, starBingo] = await Promise.all([
    womCompsPromise,
    rngBingoPromise,
    starBingoPromise,
  ]);
  return json(
    {
      competitions: [starBingo, rngBingo, ...(womComps ?? [])],
    },
    200,
  );
}
const Events = () => {
  const { competitions } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  return (
    <React.Fragment>
      <div className={'m-5 flex flex-row content-center justify-center'}>
        <Text>{'10 Most Recent Competitions'}</Text>
      </div>
      <div
        className={
          'spacing flex flex-row flex-wrap content-center items-center justify-center gap-5'
        }
      >
        <Suspense fallback={<SkeletonLoader />}>
          <Await resolve={competitions}>
            {competitions =>
              (
                competitions
                  ?.filter(x => x.startsAt < new Date().toISOString())
                  .slice(0, 10) ?? []
              ).map(comp => (
                <div className={'basis-1/6'} key={comp.id}>
                  <Card
                    style={{ minWidth: 240 }}
                    className={'cursor-pointer hover:bg-sanguine-red'}
                    onClick={() => navigate(`/events/${comp.id}`)}
                  >
                    <div className={'flex content-center items-center gap-2'}>
                      <Avatar
                        size={'3'}
                        src={SanguineLogo}
                        radius={'full'}
                        fallback="S"
                      />
                      <p>{comp.title}</p>
                    </div>
                  </Card>
                </div>
              ))
            }
          </Await>
        </Suspense>
      </div>
      <Outlet />
    </React.Fragment>
  );
};

export default Events;
