import { json, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
import {
  getCurrentTileRace,
  ITileRaceStanding,
  ITileRaceTile,
} from '~/services/tile-race-service.server';
import { getNicknameMapByDiscordIds } from '~/services/sanguine-service.server';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading } from '~/components/SectionHeading';
import { EmptyState } from '~/components/EmptyState';
import { zebraStripeClass } from '~/utils/styles';

export const meta: MetaFunction = () => {
  return [
    { title: 'Tile Race' },
    {
      name: 'description',
      content:
        'The Sanguine tile race: teams roll their way across a board of PvM tasks — live positions, current tasks, and the board itself.',
    },
  ];
};

export async function loader() {
  const race = await getCurrentTileRace().catch(() => null);
  if (!race) {
    return json({ race: null, nameByDiscordId: {} as Record<string, string> });
  }
  const nameByDiscordId = await getNicknameMapByDiscordIds(
    race.standings.flatMap(standing => standing.memberDiscordIds),
  );
  return json({ race, nameByDiscordId });
}

// Stable per-team marker colors (never sanguine red — that means members/links).
const TEAM_COLORS = [
  '#D9A13C',
  '#4FB4D8',
  '#6BBF59',
  '#A97BD6',
  '#D66BA0',
  '#C98A45',
];

const COLUMNS = 10;

// Chutes-and-ladders reading order: rows alternate direction, and short rows keep
// their tiles on the side the path travels from (nulls fill the dead cells).
const buildBoardRows = (tiles: ITileRaceTile[]): (ITileRaceTile | null)[][] =>
  Array.from({ length: Math.ceil(tiles.length / COLUMNS) }, (_, row) => {
    const slice = tiles.slice(row * COLUMNS, (row + 1) * COLUMNS);
    const padded: (ITileRaceTile | null)[] = [
      ...slice,
      ...Array<null>(COLUMNS - slice.length).fill(null),
    ];
    return row % 2 === 1 ? [...padded].reverse() : padded;
  });

const tileTitle = (tile: ITileRaceTile): string => {
  switch (tile.type) {
    case 'START':
      return 'Start';
    case 'FINISH':
      return 'Finish';
    case 'GO_BACK':
      return `Go back ${tile.amount} tiles`;
    case 'GO_FORWARD':
      return `Go forward ${tile.amount} tiles`;
    case 'TASK':
      return tile.description
        ? `${tile.name} — ${tile.description}`
        : (tile.name ?? 'Task');
  }
};

function TileCell({
  tile,
  teamsHere,
  colorByTeamId,
}: {
  tile: ITileRaceTile | null;
  teamsHere: ITileRaceStanding[];
  colorByTeamId: Record<string, string>;
}) {
  if (!tile) {
    return <div aria-hidden />;
  }

  const content = (() => {
    switch (tile.type) {
      case 'START':
        return <span className="text-[11px] text-green-400">START</span>;
      case 'FINISH':
        return <span className="text-[11px] text-green-400">FINISH</span>;
      case 'GO_BACK':
        return (
          <span className="text-[10px] leading-tight text-red-400">
            Go back {tile.amount}
          </span>
        );
      case 'GO_FORWARD':
        return (
          <span className="text-[10px] leading-tight text-sky-400">
            Forward {tile.amount}
          </span>
        );
      case 'TASK':
        return (
          <span className="text-[10px] leading-tight text-gray-200">
            {tile.name}
          </span>
        );
    }
  })();

  return (
    <div
      title={tileTitle(tile)}
      className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-sm border bg-gray-900 p-1 text-center ${
        teamsHere.length ? 'border-gray-500' : 'border-gray-800'
      }`}
    >
      <span className="absolute left-1 top-0.5 text-[9px] text-gray-600">
        {tile.index}
      </span>
      {content}
      {teamsHere.length > 0 && (
        <Flex gap="1" className="absolute bottom-0.5">
          {teamsHere.map(team => (
            <span
              key={team.teamId}
              title={team.name}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[9px] font-bold text-black"
              style={{ backgroundColor: colorByTeamId[team.teamId] }}
            >
              {team.name.charAt(0)}
            </span>
          ))}
        </Flex>
      )}
    </div>
  );
}

const statusText = (standing: ITileRaceStanding): string => {
  if (standing.isFinished) {
    return `Finished ${ordinal(standing.place ?? 0)}`;
  }
  if (standing.moveStatus === 'PENDING_APPROVAL') {
    return 'Awaiting approval';
  }
  if (standing.moveStatus === 'PENDING_SUBMISSION') {
    return 'On the task';
  }
  return 'Waiting to start';
};

const ordinal = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

export default function TileRace() {
  const { race, nameByDiscordId } = useLoaderData<typeof loader>();

  if (!race) {
    return (
      <Container size="4" mt="3" pb="6" px="4">
        <PageHeader title="Tile Race" iconSrc="/sanguine_icon_small.png">
          Teams roll their way across a board of PvM tasks. No race is running
          right now.
        </PageHeader>
        <EmptyState>You roll the dice… nothing interesting happens.</EmptyState>
      </Container>
    );
  }

  const { event, board, standings } = race;
  const colorByTeamId = Object.fromEntries(
    [...standings]
      .sort((a, b) => a.teamId.localeCompare(b.teamId))
      .map((standing, i) => [
        standing.teamId,
        TEAM_COLORS[i % TEAM_COLORS.length],
      ]),
  );
  const rows = buildBoardRows(board.tiles);
  const teamsByTile = standings.reduce<Record<number, ITileRaceStanding[]>>(
    (acc, standing) => ({
      ...acc,
      [standing.tileIndex]: [...(acc[standing.tileIndex] ?? []), standing],
    }),
    {},
  );
  const leader = standings.find(s => !s.isFinished);
  const winner = standings.find(s => s.place === 1);

  return (
    <Container size="4" mt="3" pb="6" px="4">
      <PageHeader title={event.name} iconSrc="/sanguine_icon_small.png">
        <span className="text-gray-100">{standings.length}</span> teams race
        across <span className="text-gray-100">{board.tileCount}</span> tiles
        with a d<span className="text-gray-100">{board.diceSides}</span>.{' '}
        {event.status === 'DRAFT' && 'The race has not started yet.'}
        {event.status === 'ACTIVE' &&
          winner &&
          `${winner.name} has already crossed the line.`}
        {event.status === 'ACTIVE' &&
          !winner &&
          leader &&
          `${leader.name} leads from tile ${leader.tileIndex}.`}
        {event.status === 'COMPLETED' &&
          winner &&
          `The race is over — ${winner.name} took 1st.`}
      </PageHeader>

      <Flex direction="column" gap="6">
        <Box>
          <SectionHeading
            title="Standings"
            summary={`${standings.filter(s => s.isFinished).length} of ${standings.length} finished`}
          />
          {standings.length === 0 ? (
            <EmptyState />
          ) : (
            <Table.Root size="2" mt="2">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell className="text-osrs-orange">
                    Team
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                    Members
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end" className="text-osrs-orange">
                    Tile
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                    Current task
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="text-osrs-orange">
                    Status
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {standings.map(standing => (
                  <Table.Row key={standing.teamId} className={zebraStripeClass}>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{
                            backgroundColor: colorByTeamId[standing.teamId],
                          }}
                        />
                        <Text size="2" className="text-gray-100">
                          {standing.name}
                        </Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell className="hidden sm:table-cell">
                      <Text size="2" className="text-sanguine-bright">
                        {standing.memberDiscordIds
                          .map(id => nameByDiscordId[id] ?? 'Unknown')
                          .join(', ')}
                      </Text>
                    </Table.Cell>
                    <Table.Cell justify="end">
                      <span className="whitespace-nowrap">
                        <Text size="2" className="text-gray-100">
                          {standing.tileIndex}
                        </Text>
                        <Text size="1" className="text-gray-600">
                          {' '}
                          / {standing.finishIndex}
                        </Text>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="hidden md:table-cell">
                      <Text size="2" className="text-gray-400">
                        {standing.currentTask ?? '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        size="2"
                        className={
                          standing.place === 1
                            ? 'text-osrs-gold'
                            : standing.isFinished
                              ? 'text-gray-100'
                              : 'text-gray-400'
                        }
                      >
                        {statusText(standing)}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>

        <Box>
          <SectionHeading
            title="The board"
            summary={
              <span>
                <span className="text-sky-400">forward</span> ·{' '}
                <span className="text-red-400">back</span> · hover a tile for
                its full task
              </span>
            }
          />
          <Box mt="2" className="overflow-x-auto">
            <div className="grid min-w-[40rem] grid-cols-10 gap-1">
              {rows.flat().map((tile, i) => (
                <TileCell
                  key={tile ? tile.index : `empty-${i}`}
                  tile={tile}
                  teamsHere={tile ? (teamsByTile[tile.index] ?? []) : []}
                  colorByTeamId={colorByTeamId}
                />
              ))}
            </div>
          </Box>
        </Box>
      </Flex>
    </Container>
  );
}
