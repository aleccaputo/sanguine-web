import { json, LoaderFunctionArgs } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { SectionHeading } from '~/components/SectionHeading';
import { requireStaff } from '~/services/auth.server';
import { getAdminRace } from '~/services/events-admin-service.server';

// Landing for /admin: one row per event surface with its live state. The race is
// field-picked so team rosters (Discord ids) never reach the browser.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  try {
    const race = await getAdminRace();
    return json({
      apiUp: true,
      race: race
        ? {
            name: race.event.name,
            status: race.event.status,
            teamCount: race.standings.length,
            finishedCount: race.standings.filter(s => s.isFinished).length,
          }
        : null,
    });
  } catch {
    return json({ apiUp: false, race: null });
  }
}

export default function AdminIndex() {
  const { race, apiUp } = useLoaderData<typeof loader>();

  return (
    <Box>
      <SectionHeading title="Events" />
      <div className="mt-2">
        <Link
          to="/admin/tile-race"
          className="group block border-b border-gray-800 py-3 hover:bg-sanguine-red/[0.04]"
        >
          <Flex align="baseline" justify="between" gap="3" wrap="wrap">
            <Text
              size="5"
              className="text-sanguine-bright group-hover:text-white"
            >
              Tile race
            </Text>
            <Text size="4" className="text-gray-400">
              {!apiUp ? (
                <span className="text-red-400">events API unreachable</span>
              ) : race === null ? (
                'no open race — create one'
              ) : race.status === 'DRAFT' ? (
                <>
                  {race.name} — draft,{' '}
                  <span className="text-gray-100">{race.teamCount}</span> team
                  {race.teamCount === 1 ? '' : 's'}
                </>
              ) : (
                <>
                  {race.name} — active,{' '}
                  <span className="text-gray-100">{race.finishedCount}</span> of{' '}
                  <span className="text-gray-100">{race.teamCount}</span>{' '}
                  finished
                </>
              )}
            </Text>
          </Flex>
          <Text as="p" size="4" className="mt-1 text-gray-500">
            Dice-roll board race. Build the board, manage teams, start the race,
            and fix moves when something goes sideways.
          </Text>
        </Link>
        <div className="border-b border-gray-800 py-3">
          <Flex align="baseline" justify="between" gap="3" wrap="wrap">
            <Text size="5" className="text-gray-500">
              Bingo
            </Text>
            <Text size="4" className="text-gray-600">
              planned
            </Text>
          </Flex>
          <Text as="p" size="4" className="mt-1 text-gray-600">
            Team task boards. Not built yet.
          </Text>
        </div>
      </div>
    </Box>
  );
}
