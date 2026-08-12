import { json, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
import {
  getCurrentTileRace,
  ITileRaceStanding,
  ITileRaceTile,
} from '~/services/tile-race-service.server';
import { getAdminRace } from '~/services/events-admin-service.server';
import { getNicknameMapByDiscordIds } from '~/services/sanguine-service.server';
import { PageHeader } from '~/components/PageHeader';
import { SectionHeading } from '~/components/SectionHeading';
import { EmptyState } from '~/components/EmptyState';
import { zebraStripeClass } from '~/utils/styles';
import {
  chunkIntoSnakeRows,
  groupTilesIntoTiers,
} from '~/utils/tile-race-board';
import { getTileImageUrl } from '~/utils/tile-race-images';
import { TileArt } from '~/components/TileArt';

export const meta: MetaFunction = () => {
  return [
    { title: 'Tile Race' },
    {
      name: 'description',
      content:
        'The Sanguine tile race: teams roll their way across a board of PvM tasks, with live positions, current tasks, and the board itself.',
    },
  ];
};

export async function loader() {
  // Prefer the authed admin read — it carries member rosters, which the public API
  // payload deliberately omits. Rosters resolve to nicknames server-side; raw Discord
  // ids never reach the browser. Falls back to the public payload (roster-less) so the
  // page still renders if the service token is missing.
  const adminRace = await getAdminRace().catch(() => null);
  const race = adminRace ?? (await getCurrentTileRace().catch(() => null));
  if (!race) {
    return json({ race: null });
  }
  const memberIdsByTeamId = new Map(
    (adminRace?.standings ?? []).map(s => [s.teamId, s.memberDiscordIds]),
  );
  const nameByDiscordId = await getNicknameMapByDiscordIds(
    [...memberIdsByTeamId.values()].flat(),
  );
  return json({
    race: {
      event: race.event,
      board: race.board,
      standings: race.standings.map(standing => ({
        teamId: standing.teamId,
        name: standing.name,
        place: standing.place,
        tileIndex: standing.tileIndex,
        finishIndex: standing.finishIndex,
        tier: standing.tier ?? null,
        tierCount: standing.tierCount ?? null,
        currentTask: standing.currentTask,
        moveStatus: standing.moveStatus,
        isFinished: standing.isFinished,
        memberNames: (memberIdsByTeamId.get(standing.teamId) ?? []).map(
          id => nameByDiscordId[id] ?? 'Unknown',
        ),
      })),
    },
  });
}

interface IStandingView extends ITileRaceStanding {
  memberNames: string[];
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
    case 'TASK': {
      const base = tile.description
        ? `${tile.name}: ${tile.description}`
        : (tile.name ?? 'Task');
      return (tile.quantity ?? 1) > 1
        ? `${base} (${tile.quantity} approved drops to complete)`
        : base;
    }
  }
};

function TileCell({
  tile,
  teamsHere,
  colorByTeamId,
}: {
  tile: ITileRaceTile | null;
  teamsHere: IStandingView[];
  colorByTeamId: Record<string, string>;
}) {
  if (!tile) {
    return <div aria-hidden />;
  }

  const imageUrl =
    tile.type === 'TASK'
      ? (tile.imageUrl ?? getTileImageUrl(tile.name, tile.description))
      : null;

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
      {imageUrl && <TileArt src={imageUrl} />}
      <span className="absolute left-1 top-0.5 text-[9px] text-gray-600">
        {tile.index}
      </span>
      {tile.type === 'TASK' && (tile.quantity ?? 1) > 1 && (
        <span className="absolute right-1 top-0.5 text-[9px] text-osrs-gold">
          ×{tile.quantity}
        </span>
      )}
      {/* relative lifts the label above the absolutely-positioned artwork */}
      <span className="relative">{content}</span>
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
  const { race } = useLoaderData<typeof loader>();

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
  const tiered = board.mode === 'TIERED';
  const tierSizes = board.tierSizes ?? [];
  const colorByTeamId = Object.fromEntries(
    [...standings]
      .sort((a, b) => a.teamId.localeCompare(b.teamId))
      .map((standing, i) => [
        standing.teamId,
        TEAM_COLORS[i % TEAM_COLORS.length],
      ]),
  );
  const rows = chunkIntoSnakeRows(board.tiles);
  const teamsByTile = standings.reduce<Record<number, IStandingView[]>>(
    (acc, standing) => ({
      ...acc,
      [standing.tileIndex]: [...(acc[standing.tileIndex] ?? []), standing],
    }),
    {},
  );
  const leader = standings.find(s => !s.isFinished);
  const winner = standings.find(s => s.place === 1);
  const hasRosters = standings.some(s => s.memberNames.length > 0);

  return (
    <Container size="4" mt="3" pb="6" px="4">
      <PageHeader title={event.name} iconSrc="/sanguine_icon_small.png">
        {tiered ? (
          <>
            <span className="text-gray-100">{standings.length}</span> teams
            race through{' '}
            <span className="text-gray-100">{tierSizes.length}</span> tiers of
            tasks, one task per tier: each roll picks from the tiles of the
            next tier.{' '}
          </>
        ) : (
          <>
            <span className="text-gray-100">{standings.length}</span> teams
            race across <span className="text-gray-100">{board.tileCount}</span>{' '}
            tiles with a d
            <span className="text-gray-100">{board.diceSides}</span>.{' '}
          </>
        )}
        {event.status === 'DRAFT' && 'The race has not started yet.'}
        {event.status === 'ACTIVE' &&
          winner &&
          `${winner.name} has already crossed the line.`}
        {event.status === 'ACTIVE' &&
          !winner &&
          leader &&
          (tiered
            ? `${leader.name} leads from tier ${leader.tier ?? 0}.`
            : `${leader.name} leads from tile ${leader.tileIndex}.`)}
        {event.status === 'COMPLETED' &&
          winner &&
          `The race is over. ${winner.name} took 1st.`}
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
                  {hasRosters && (
                    <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                      Members
                    </Table.ColumnHeaderCell>
                  )}
                  <Table.ColumnHeaderCell justify="end" className="text-osrs-orange">
                    {tiered ? 'Tier' : 'Tile'}
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
                    {hasRosters && (
                      <Table.Cell className="hidden sm:table-cell">
                        <Text size="2" className="text-sanguine-bright">
                          {standing.memberNames.join(', ')}
                        </Text>
                      </Table.Cell>
                    )}
                    <Table.Cell justify="end">
                      <span className="whitespace-nowrap">
                        <Text size="2" className="text-gray-100">
                          {tiered
                            ? // A finished team derives as tierCount + 1 (FINISH) — show the last tier
                              Math.min(standing.tier ?? 0, tierSizes.length)
                            : standing.tileIndex}
                        </Text>
                        <Text size="1" className="text-gray-600">
                          {' '}
                          / {tiered ? tierSizes.length : standing.finishIndex}
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
              tiered ? (
                <span>hover a tile for its full task</span>
              ) : (
                <span>
                  <span className="text-sky-400">forward</span> ·{' '}
                  <span className="text-red-400">back</span> · hover a tile for
                  its full task
                </span>
              )
            }
          />
          {tiered ? (
            <Flex direction="column" gap="3" mt="2">
              {[
                board.tiles.slice(0, 1),
                ...groupTilesIntoTiers(board.tiles, tierSizes),
                board.tiles.slice(-1),
              ].map((tierTiles, tierIndex) => (
                <Box key={tierIndex}>
                  {tierIndex > 0 && tierIndex <= tierSizes.length && (
                    <Text as="p" size="3" className="text-osrs-orange">
                      Tier {tierIndex}{' '}
                      <span className="text-gray-500">
                        · rolls a d{tierTiles.length}
                      </span>
                    </Text>
                  )}
                  <Box className="overflow-x-auto">
                    <div className="mt-1 grid min-w-[40rem] grid-cols-10 gap-1">
                      {tierTiles.map(tile => (
                        <TileCell
                          key={tile.index}
                          tile={tile}
                          teamsHere={teamsByTile[tile.index] ?? []}
                          colorByTeamId={colorByTeamId}
                        />
                      ))}
                    </div>
                  </Box>
                </Box>
              ))}
            </Flex>
          ) : (
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
          )}
        </Box>
      </Flex>
    </Container>
  );
}
