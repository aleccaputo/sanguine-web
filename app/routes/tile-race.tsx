import { useEffect, useState } from 'react';
import { json, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  Box,
  Container,
  Dialog,
  Flex,
  Popover,
  Table,
  Text,
} from '@radix-ui/themes';
import {
  getCurrentTileRace,
  ITileRaceHistoryEntry,
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
  countRevealedTiers,
  groupTilesIntoTiers,
  redactTilesBeyondTier,
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
  // Drafts are staff-only work in progress — the public page only shows a race
  // once it has been started (or has finished).
  if (!race || race.event.status === 'DRAFT') {
    return json({ race: null });
  }
  const memberIdsByTeamId = new Map(
    (adminRace?.standings ?? []).map(s => [s.teamId, s.memberDiscordIds]),
  );
  // One nickname lookup covers rosters and history submitters alike.
  const submitterIds = race.standings.flatMap(s =>
    (s.history ?? []).flatMap(entry =>
      entry.submittedByDiscordId ? [entry.submittedByDiscordId] : [],
    ),
  );
  const nameByDiscordId = await getNicknameMapByDiscordIds([
    ...[...memberIdsByTeamId.values()].flat(),
    ...submitterIds,
  ]);
  // Suspense: on a live tiered race, tiers no team has reached stay face-down.
  // Redacted here rather than hidden in the UI so the unrevealed tasks never
  // reach the browser at all. A completed race shows the whole board.
  const raceTierSizes = race.board.tierSizes ?? [];
  const revealedTierCount =
    race.board.mode === 'TIERED' && race.event.status === 'ACTIVE'
      ? countRevealedTiers(race.standings, raceTierSizes.length)
      : null;
  return json({
    race: {
      event: race.event,
      board:
        revealedTierCount !== null
          ? {
              ...race.board,
              tiles: redactTilesBeyondTier(
                race.board.tiles,
                raceTierSizes,
                revealedTierCount,
              ),
            }
          : race.board,
      revealedTierCount,
      standings: race.standings.map(standing => ({
        teamId: standing.teamId,
        name: standing.name,
        place: standing.place,
        tileIndex: standing.tileIndex,
        finishIndex: standing.finishIndex,
        tier: standing.tier ?? null,
        tierCount: standing.tierCount ?? null,
        currentTask: standing.currentTask,
        taskProgress: standing.taskProgress ?? null,
        moveStatus: standing.moveStatus,
        pendingSubmissions: standing.pendingSubmissions ?? 0,
        isFinished: standing.isFinished,
        memberNames: (memberIdsByTeamId.get(standing.teamId) ?? []).map(
          id => nameByDiscordId[id] ?? 'Unknown',
        ),
        // Submitter ids resolve to nicknames server-side, like rosters do.
        history: (standing.history ?? []).map(
          ({ submittedByDiscordId, ...entry }) => ({
            ...entry,
            submittedBy: submittedByDiscordId
              ? nameByDiscordId[submittedByDiscordId] ?? null
              : null,
          }),
        ),
      })),
    },
  });
}

interface IHistoryEntryView
  extends Omit<ITileRaceHistoryEntry, 'submittedByDiscordId'> {
  /** Submitter's clan nickname, resolved server-side (admin payload only) */
  submittedBy: string | null;
}

interface IStandingView extends Omit<ITileRaceStanding, 'history'> {
  memberNames: string[];
  history: IHistoryEntryView[];
}

// The public board renders wider tiles than the admin builder's 10-column grid —
// consumers read the board, admins pack it.
const BOARD_VIEW_COLUMNS = 8;

// Stable per-team identities: an OSRS god symbol (from /public/god-symbols)
// paired with the accent color matching its canonical palette. The accent drives
// borders/rails/legend; the symbol is the pawn. Never sanguine red — that means
// members/links.
const TEAM_IDENTITIES = [
  { color: '#D9A13C', god: 'saradomin' },
  { color: '#4FB4D8', god: 'armadyl' },
  { color: '#6BBF59', god: 'guthix' },
  { color: '#A97BD6', god: 'zaros' },
  { color: '#D66BA0', god: 'zamorak' },
  { color: '#C98A45', god: 'bandos' },
];

const TEAM_COLORS = TEAM_IDENTITIES.map(identity => identity.color);
const GOD_BY_COLOR = Object.fromEntries(
  TEAM_IDENTITIES.map(identity => [identity.color, identity.god]),
);

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
        : tile.name ?? 'Task';
      return (tile.quantity ?? 1) > 1
        ? `${base} (${tile.quantity} approved drops to complete)`
        : base;
    }
  }
};

const statusText = (standing: ITileRaceStanding): string => {
  if (standing.isFinished) {
    return `Finished ${ordinal(standing.place ?? 0)}`;
  }
  // The submission queue keeps the move PENDING_SUBMISSION while screenshots
  // await approval; PENDING_APPROVAL only exists on pre-queue API deploys.
  const pending = standing.pendingSubmissions ?? 0;
  if (pending > 1) {
    return `Awaiting approval (${pending})`;
  }
  if (pending === 1 || standing.moveStatus === 'PENDING_APPROVAL') {
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

/**
 * Square game-pawn marker: the team's god symbol framed in its accent color.
 * The god derives from the color (they're paired in TEAM_IDENTITIES), with the
 * team initial as a fallback if the pairing ever misses.
 */
function TeamToken({
  name,
  color,
  size = 'md',
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}) {
  const god = GOD_BY_COLOR[color];
  const sizeClass =
    size === 'sm'
      ? 'h-5 w-5 text-[11px] sm:h-6 sm:w-6 sm:text-xs'
      : 'h-6 w-6 text-xs sm:h-8 sm:w-8 sm:text-sm';
  return (
    <span
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-sm border-2 bg-[#111113] p-0.5 font-bold text-gray-100 ${sizeClass}`}
      style={{ borderColor: color }}
    >
      {god ? (
        <img
          src={`/god-symbols/${god}.png`}
          alt=""
          className="h-full w-full object-contain [image-rendering:pixelated]"
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}

/** One cleared tile plus the team that cleared it — a line in the race history. */
interface IClearedTile {
  team: IStandingView;
  entry: IHistoryEntryView;
}

// UTC pinned so the server render and every viewer's hydration agree on the date.
const historyDate = (iso: string | null): string | null =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null;

/** The OSRS hint arrow: a bouncing gold arrow marking the spotted team. */
function HintArrow({
  className = 'h-7 w-7 sm:h-8 sm:w-8',
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-bounce ${className}`}>
      <path
        d="M12 22 L4 12 H8 V2 H16 V12 H20 Z"
        fill="#D9A13C"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TileCell({
  tile,
  teamsHere,
  clearsHere,
  colorByTeamId,
  highlightTeamId,
}: {
  tile: ITileRaceTile | null;
  teamsHere: IStandingView[];
  clearsHere: IClearedTile[];
  colorByTeamId: Record<string, string>;
  highlightTeamId: string | null;
}) {
  if (!tile) {
    return <div aria-hidden />;
  }

  const imageUrl =
    tile.type === 'TASK'
      ? tile.imageUrl ?? getTileImageUrl(tile.name, tile.description)
      : null;
  const highlighted = teamsHere.some(team => team.teamId === highlightTeamId);
  const soleOccupant = teamsHere.length === 1 ? teamsHere[0] : null;

  const label = (() => {
    switch (tile.type) {
      case 'START':
        return (
          <span className="text-sm text-green-400 sm:text-base">START</span>
        );
      case 'FINISH':
        return (
          <span className="text-sm text-green-400 sm:text-base">FINISH</span>
        );
      case 'GO_BACK':
        return (
          <span className="text-xs leading-tight text-red-400 sm:text-sm">
            Go back {tile.amount}
          </span>
        );
      case 'GO_FORWARD':
        return (
          <span className="text-xs leading-tight text-sky-400 sm:text-sm">
            Forward {tile.amount}
          </span>
        );
      case 'TASK':
        return (
          <span className="text-xs leading-tight text-gray-200 sm:text-sm">
            {tile.name}
          </span>
        );
    }
  })();

  const detailHeading = (() => {
    switch (tile.type) {
      case 'START':
        return (
          <Text size="2" className="text-green-400">
            Start · every team begins here
          </Text>
        );
      case 'FINISH':
        return (
          <Text size="2" className="text-green-400">
            Finish · first team here wins
          </Text>
        );
      case 'GO_BACK':
        return (
          <Text size="2" className="text-red-400">
            Go back {tile.amount} tiles
          </Text>
        );
      case 'GO_FORWARD':
        return (
          <Text size="2" className="text-sky-400">
            Go forward {tile.amount} tiles
          </Text>
        );
      case 'TASK':
        return (
          <Text size="2" className="text-gray-100">
            {tile.name}
          </Text>
        );
    }
  })();

  return (
    <Popover.Root>
      <Popover.Trigger>
        <button
          type="button"
          id={`tile-${tile.index}`}
          title={tileTitle(tile)}
          className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-sm bg-sanguine-red/[0.05] p-1 text-center transition-opacity duration-200 ${
            teamsHere.length > 1
              ? 'border-2 border-gray-400'
              : soleOccupant
                ? 'border-2'
                : 'border border-sanguine-red/[0.18]'
          } ${highlightTeamId !== null && !highlighted ? 'opacity-40' : ''}`}
          style={
            soleOccupant
              ? { borderColor: colorByTeamId[soleOccupant.teamId] }
              : undefined
          }
        >
          {imageUrl && <TileArt src={imageUrl} />}
          <span className="absolute left-1 top-0.5 text-[10px] text-gray-500 sm:text-xs">
            {tile.index}
          </span>
          {tile.type === 'TASK' && (tile.quantity ?? 1) > 1 && (
            <span className="absolute right-1 top-0.5 text-[10px] text-osrs-gold sm:text-xs">
              {/* A lone occupant's live count beats the static ×N requirement */}
              {soleOccupant?.taskProgress != null
                ? `${soleOccupant.taskProgress}/${tile.quantity}`
                : `×${tile.quantity}`}
            </span>
          )}
          {/* relative lifts the label above the absolutely-positioned artwork */}
          <span className="relative">{label}</span>
          {clearsHere.length > 0 && tile.type === 'TASK' && (
            // Quest-complete check: this tile has clears — click for the story
            <span className="absolute bottom-0.5 right-1 text-xs text-green-400 sm:text-sm">
              ✓{clearsHere.length > 1 && clearsHere.length}
            </span>
          )}
          {highlighted && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1 z-[1] flex justify-center"
            >
              <HintArrow />
            </span>
          )}
          {teamsHere.length > 0 && (
            <span
              className={`absolute bottom-1 flex ${teamsHere.length > 3 ? '-space-x-1.5' : 'gap-1'}`}
            >
              {teamsHere.map(team => (
                <TeamToken
                  key={team.teamId}
                  name={team.name}
                  color={colorByTeamId[team.teamId]}
                />
              ))}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content size="1" className="max-w-80">
        <Flex direction="column" gap="1">
          <Text size="1" className="text-gray-600">
            Tile {tile.index}
          </Text>
          {detailHeading}
          {tile.type === 'TASK' && tile.description && (
            <Text size="2" className="text-gray-400">
              {tile.description}
            </Text>
          )}
          {tile.type === 'TASK' && (tile.quantity ?? 1) > 1 && (
            <Text size="2" className="text-osrs-gold">
              ×{tile.quantity} approved drops to complete
            </Text>
          )}
          {teamsHere.length > 0 && (
            <Flex direction="column" gap="1" className="pt-1">
              {teamsHere.map(team => (
                <Flex key={team.teamId} align="center" gap="2">
                  <TeamToken
                    name={team.name}
                    color={colorByTeamId[team.teamId]}
                    size="sm"
                  />
                  <Text size="2" className="text-gray-100">
                    {team.name}
                  </Text>
                  <Text size="1" className="text-gray-500">
                    {statusText(team)}
                  </Text>
                  {team.taskProgress != null && (
                    <Text size="1" className="text-osrs-gold">
                      {team.taskProgress}/{tile.quantity}
                    </Text>
                  )}
                </Flex>
              ))}
            </Flex>
          )}
          {/* Who already got through here, and (per the submitter's note) how */}
          {clearsHere.length > 0 && (
            <Flex
              direction="column"
              gap="1"
              className="mt-1 border-t border-gray-800 pt-2"
            >
              {clearsHere.map(({ team, entry }, i) => (
                // Index in the key: go-back loops can land a team on a tile twice
                <Flex
                  key={`${team.teamId}-${entry.tileIndex}-${i}`}
                  align="center"
                  gap="2"
                >
                  <TeamToken
                    name={team.name}
                    color={colorByTeamId[team.teamId]}
                    size="sm"
                  />
                  {/* The note is optional at submission; without one the row is
                      just the check and the date */}
                  <Text size="2" className="text-green-400">
                    ✓
                  </Text>
                  {entry.note && (
                    <Text size="2" className="text-gray-400">
                      “{entry.note}”
                    </Text>
                  )}
                  <Text size="1" className="text-gray-600">
                    {historyDate(entry.completedAt)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}

/** One snake row of the classic board plus the turn connector down to the next row. */
function BoardRow({
  row,
  rowIndex,
  isLast,
  teamsByTile,
  clearsByTile,
  colorByTeamId,
  highlightTeamId,
}: {
  row: (ITileRaceTile | null)[];
  rowIndex: number;
  isLast: boolean;
  teamsByTile: Record<number, IStandingView[]>;
  clearsByTile: Record<number, IClearedTile[]>;
  colorByTeamId: Record<string, string>;
  highlightTeamId: string | null;
}) {
  return (
    <>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${BOARD_VIEW_COLUMNS}, minmax(0, 1fr))`,
        }}
      >
        {row.map((tile, i) => (
          <TileCell
            key={tile ? tile.index : `empty-${rowIndex}-${i}`}
            tile={tile}
            teamsHere={tile ? teamsByTile[tile.index] ?? [] : []}
            clearsHere={tile ? clearsByTile[tile.index] ?? [] : []}
            colorByTeamId={colorByTeamId}
            highlightTeamId={highlightTeamId}
          />
        ))}
      </div>
      {!isLast && (
        <div
          className="grid h-3 gap-1"
          style={{
            gridTemplateColumns: `repeat(${BOARD_VIEW_COLUMNS}, minmax(0, 1fr))`,
          }}
        >
          {/* the path snakes: even rows run left→right and turn down the right edge */}
          <div
            className="flex justify-center"
            style={{
              gridColumnStart: rowIndex % 2 === 0 ? BOARD_VIEW_COLUMNS : 1,
            }}
          >
            <div className="w-1.5 bg-gray-600" />
          </div>
        </div>
      )}
    </>
  );
}

/** Segmented (tiered) or continuous (classic) progress rail under the tile number. */
function ProgressRail({
  standing,
  color,
  tiered,
  tierCount,
}: {
  standing: IStandingView;
  color: string;
  tiered: boolean;
  tierCount: number;
}) {
  if (tiered) {
    return (
      <span className="mt-1 hidden justify-end gap-0.5 sm:flex">
        {Array.from({ length: tierCount }, (_, i) => {
          const cleared = standing.isFinished || (standing.tier ?? 0) > i + 1;
          const current = !standing.isFinished && standing.tier === i + 1;
          return (
            <span
              key={i}
              className="h-1.5 w-4 rounded-sm"
              style={{
                backgroundColor: cleared
                  ? color
                  : current
                    ? `${color}59`
                    : '#2A2A2E',
              }}
            />
          );
        })}
      </span>
    );
  }
  return (
    <span className="ml-auto mt-1 hidden h-1.5 w-24 rounded-sm bg-gray-800 sm:block">
      <span
        className="block h-full rounded-sm"
        style={{
          width: `${Math.round((standing.tileIndex / Math.max(standing.finishIndex, 1)) * 100)}%`,
          backgroundColor: color,
        }}
      />
    </span>
  );
}

export default function TileRace() {
  const { race } = useLoaderData<typeof loader>();
  const [highlightTeamId, setHighlightTeamId] = useState<string | null>(null);
  const [rosterTeam, setRosterTeam] = useState<IStandingView | null>(null);

  // Dismiss the spotlight like a modal: any click that isn't on a team control
  // (standings row, legend chip — those toggle it themselves) lifts it.
  useEffect(() => {
    if (highlightTeamId === null) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-spotlight-control]')
      ) {
        return;
      }
      setHighlightTeamId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [highlightTeamId]);

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
  // null = nothing hidden (classic board, or a finished race shows everything)
  const revealedTiers = race.revealedTierCount ?? tierSizes.length;
  const hiddenTierCount = Math.max(tierSizes.length - revealedTiers, 0);
  const colorByTeamId = Object.fromEntries(
    [...standings]
      .sort((a, b) => a.teamId.localeCompare(b.teamId))
      .map((standing, i) => [
        standing.teamId,
        TEAM_COLORS[i % TEAM_COLORS.length],
      ]),
  );
  const rows = chunkIntoSnakeRows(board.tiles, BOARD_VIEW_COLUMNS);
  const teamsByTile = standings.reduce<Record<number, IStandingView[]>>(
    (acc, standing) => ({
      ...acc,
      [standing.tileIndex]: [...(acc[standing.tileIndex] ?? []), standing],
    }),
    {},
  );
  const leader = standings.find(s => !s.isFinished);
  const winner = standings.find(s => s.place === 1);
  const finishers = [...standings]
    .filter(s => s.isFinished)
    .sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  const hasRosters = standings.some(s => s.memberNames.length > 0);

  // Clicking a team spotlights its tile (hint arrow + the rest of the board
  // dimmed); clicking the same team again lifts the spotlight.
  const jumpToTeam = (standing: IStandingView) => {
    if (highlightTeamId === standing.teamId) {
      setHighlightTeamId(null);
      return;
    }
    setHighlightTeamId(standing.teamId);
    document.getElementById(`tile-${standing.tileIndex}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  };

  const startTile = board.tiles[0];
  const finishTile = board.tiles[board.tiles.length - 1];

  const tileNameByIndex = (index: number): string =>
    board.tiles[index]?.name ?? `Tile ${index}`;
  // Every cleared tile across all teams, oldest first — tier rails and the race log.
  const clearedTiles: IClearedTile[] = standings
    .flatMap(team => team.history.map(entry => ({ team, entry })))
    .sort((a, b) =>
      (a.entry.completedAt ?? '').localeCompare(b.entry.completedAt ?? ''),
    );
  // Per-tile clears feed the tile popovers ("who got through here, and how").
  const clearsByTile = clearedTiles.reduce<Record<number, IClearedTile[]>>(
    (acc, clear) => ({
      ...acc,
      [clear.entry.tileIndex]: [...(acc[clear.entry.tileIndex] ?? []), clear],
    }),
    {},
  );

  return (
    // Wider than the site's Container 4: the board is the star of this page and
    // earns the extra horizontal room.
    <Box className="mx-auto w-full max-w-[1500px] px-4 pb-6 pt-3 sm:px-6">
      <PageHeader title={event.name} iconSrc="/sanguine_icon_small.png">
        {tiered ? (
          <>
            <span className="text-gray-100">{standings.length}</span> teams ·{' '}
            <span className="text-gray-100">{tierSizes.length}</span> tiers ·{' '}
            <span className="text-gray-100">{board.tileCount}</span> tasks
          </>
        ) : (
          <>
            <span className="text-gray-100">{standings.length}</span> teams ·{' '}
            <span className="text-gray-100">{board.tileCount}</span> tiles ·
            rolls a d<span className="text-gray-100">{board.diceSides}</span>
          </>
        )}
        {event.status === 'ACTIVE' &&
          winner &&
          ` · ${winner.name} finished 1st`}
        {event.status === 'ACTIVE' &&
          !winner &&
          leader &&
          (tiered
            ? ` · ${leader.name} leads from tier ${leader.tier ?? 0}`
            : ` · ${leader.name} leads on tile ${leader.tileIndex}`)}
        {event.status === 'COMPLETED' &&
          winner &&
          ` · race over, ${winner.name} took 1st`}
      </PageHeader>

      <Flex direction="column" gap="6">
        <Box>
          <SectionHeading
            title="Standings"
            summary={
              <Text size="2" className="text-gray-500">
                {standings.filter(s => s.isFinished).length} of{' '}
                {standings.length} finished · click a team to spot them on the
                board
              </Text>
            }
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
                    <Table.ColumnHeaderCell className="text-osrs-orange">
                      Members
                    </Table.ColumnHeaderCell>
                  )}
                  <Table.ColumnHeaderCell
                    justify="end"
                    className="hidden text-osrs-orange sm:table-cell"
                  >
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
                  <Table.Row
                    key={standing.teamId}
                    data-spotlight-control
                    onClick={() => jumpToTeam(standing)}
                    className={`${zebraStripeClass} cursor-pointer hover:bg-sanguine-red/[0.09]`}
                  >
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <TeamToken
                          name={standing.name}
                          color={colorByTeamId[standing.teamId]}
                          size="sm"
                        />
                        <Text size="2" className="text-gray-100">
                          {standing.name}
                        </Text>
                      </Flex>
                    </Table.Cell>
                    {hasRosters && (
                      // stopPropagation: opening the roster must not also jump the board
                      <Table.Cell onClick={e => e.stopPropagation()}>
                        {standing.memberNames.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setRosterTeam(standing)}
                            className="text-sanguine-bright hover:text-white"
                          >
                            <Text size="2" className="whitespace-nowrap">
                              {standing.memberNames.length} members
                            </Text>
                          </button>
                        ) : (
                          <Text size="2" className="text-gray-600" />
                        )}
                      </Table.Cell>
                    )}
                    <Table.Cell justify="end" className="hidden sm:table-cell">
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
                      <ProgressRail
                        standing={standing}
                        color={colorByTeamId[standing.teamId]}
                        tiered={tiered}
                        tierCount={tierSizes.length}
                      />
                    </Table.Cell>
                    <Table.Cell className="hidden md:table-cell">
                      <Text size="2" className="text-gray-400">
                        {standing.currentTask ?? ''}
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
                <Text size="2" className="text-gray-500">
                  click a tile for its full task
                  {hiddenTierCount > 0 &&
                    ' · deeper tiers are revealed as teams reach them'}
                </Text>
              ) : (
                <Text size="2" className="text-gray-500">
                  <span className="text-sky-400">forward</span> ·{' '}
                  <span className="text-red-400">back</span> · click a tile for
                  its full task
                </Text>
              )
            }
          />
          {/* Rides below the fixed navbar while the board scrolls: every team stays
              one click away from its tile. Solid background, never backdrop-blur. */}
          {standings.length > 0 && (
            <Box className="sticky top-[73px] z-10 -mx-4 border-b border-gray-800 bg-[#111113] px-4 py-1.5 sm:-mx-6 sm:px-6">
              <Flex align="center" gap="1" wrap="wrap">
                {standings.map(standing => (
                  <button
                    key={standing.teamId}
                    type="button"
                    data-spotlight-control
                    onClick={() => jumpToTeam(standing)}
                    className={`flex items-center gap-2 rounded-sm px-2 py-1 text-left ${
                      highlightTeamId === standing.teamId
                        ? 'bg-sanguine-red/10'
                        : 'hover:bg-sanguine-red/[0.09]'
                    }`}
                  >
                    <TeamToken
                      name={standing.name}
                      color={colorByTeamId[standing.teamId]}
                      size="sm"
                    />
                    <span className="flex flex-col leading-tight">
                      <Text size="2" className="text-gray-100">
                        {standing.name}
                      </Text>
                      <span
                        className={`text-xs ${standing.isFinished ? 'text-osrs-gold' : 'text-gray-500'}`}
                      >
                        {standing.isFinished
                          ? `Finished ${ordinal(standing.place ?? 0)}`
                          : tiered
                            ? `tier ${standing.tier ?? 0}`
                            : `tile ${standing.tileIndex}`}
                      </span>
                    </span>
                  </button>
                ))}
              </Flex>
            </Box>
          )}
          {tiered ? (
            <Flex direction="column" gap="4" mt="3">
              <Flex
                id={`tile-${startTile.index}`}
                align="center"
                gap="3"
                className="rounded-sm border border-sanguine-red/[0.18] bg-sanguine-red/[0.05] px-3 py-2"
              >
                <Text size="2" className="text-green-400">
                  START
                </Text>
                <Flex gap="1" align="center">
                  {(teamsByTile[startTile.index] ?? []).map(team => (
                    <Flex key={team.teamId} align="center" gap="1">
                      {highlightTeamId === team.teamId && (
                        <HintArrow className="h-5 w-5" />
                      )}
                      <TeamToken
                        name={team.name}
                        color={colorByTeamId[team.teamId]}
                      />
                    </Flex>
                  ))}
                </Flex>
                <Text size="1" className="text-gray-600">
                  every team rolls into tier 1
                </Text>
              </Flex>
              {groupTilesIntoTiers(board.tiles, tierSizes).map(
                (tierTiles, i) => {
                  const tierNumber = i + 1;
                  if (tierNumber > revealedTiers) {
                    // Face-down tier: no team has reached it yet, and its task
                    // content was redacted server-side. Only the tile count
                    // (the die size, already public mechanics) shows.
                    return (
                      <Box key={tierNumber}>
                        <Text as="p" size="3" className="text-gray-600">
                          Tier {tierNumber}{' '}
                          <span className="text-gray-700">
                            · rolls a d{tierTiles.length}
                          </span>
                        </Text>
                        <Flex
                          align="center"
                          gap="3"
                          wrap="wrap"
                          className="mt-1 rounded-sm border border-sanguine-red/[0.12] bg-sanguine-red/[0.03] px-3 py-2"
                        >
                          <Flex gap="1" wrap="wrap">
                            {tierTiles.map(tile => (
                              <span
                                key={tile.index}
                                aria-hidden
                                className="flex h-8 w-8 items-center justify-center rounded-sm border border-sanguine-red/[0.12] bg-[#111113] text-sm text-gray-700"
                              >
                                ?
                              </span>
                            ))}
                          </Flex>
                          <Text size="1" className="text-gray-600">
                            revealed when the first team gets here
                          </Text>
                        </Flex>
                      </Box>
                    );
                  }
                  const teamsInTier = standings.filter(
                    s => !s.isFinished && s.tier === tierNumber,
                  );
                  return (
                    <Box key={tierNumber}>
                      <Flex align="center" gap="2">
                        <Text as="p" size="3" className="text-osrs-orange">
                          Tier {tierNumber}{' '}
                          <span className="text-gray-500">
                            · rolls a d{tierTiles.length}
                          </span>
                        </Text>
                        {teamsInTier.map(team => (
                          <TeamToken
                            key={team.teamId}
                            name={team.name}
                            color={colorByTeamId[team.teamId]}
                            size="sm"
                          />
                        ))}
                      </Flex>
                      <Box className="overflow-x-auto">
                        <div
                          className="mt-1 grid min-w-[48rem] gap-1"
                          style={{
                            gridTemplateColumns: `repeat(${BOARD_VIEW_COLUMNS}, minmax(0, 1fr))`,
                          }}
                        >
                          {tierTiles.map(tile => (
                            <TileCell
                              key={tile.index}
                              tile={tile}
                              teamsHere={teamsByTile[tile.index] ?? []}
                              clearsHere={clearsByTile[tile.index] ?? []}
                              colorByTeamId={colorByTeamId}
                              highlightTeamId={highlightTeamId}
                            />
                          ))}
                        </div>
                      </Box>
                    </Box>
                  );
                },
              )}
              <Flex
                id={`tile-${finishTile.index}`}
                align="center"
                gap="3"
                className="rounded-sm border border-sanguine-red/[0.18] bg-sanguine-red/[0.05] px-3 py-2"
              >
                <Text size="2" className="text-green-400">
                  FINISH
                </Text>
                {finishers.length === 0 ? (
                  <Text size="1" className="text-gray-600">
                    no team has crossed yet
                  </Text>
                ) : (
                  finishers.map(team => (
                    <Flex key={team.teamId} align="center" gap="1">
                      {highlightTeamId === team.teamId && (
                        <HintArrow className="h-5 w-5" />
                      )}
                      <TeamToken
                        name={team.name}
                        color={colorByTeamId[team.teamId]}
                      />
                      <Text size="1" className="text-osrs-gold">
                        {ordinal(team.place ?? 0)}
                      </Text>
                    </Flex>
                  ))
                )}
              </Flex>
            </Flex>
          ) : (
            <Box mt="3" className="overflow-x-auto">
              <div className="flex min-w-[48rem] flex-col gap-1">
                {rows.map((row, rowIndex) => (
                  <BoardRow
                    key={rowIndex}
                    row={row}
                    rowIndex={rowIndex}
                    isLast={rowIndex === rows.length - 1}
                    teamsByTile={teamsByTile}
                    clearsByTile={clearsByTile}
                    colorByTeamId={colorByTeamId}
                    highlightTeamId={highlightTeamId}
                  />
                ))}
              </div>
            </Box>
          )}
        </Box>

        {/* One shared log for the whole race, newest first — the fresh clears
            are what checkers come back for. Per-tile detail lives in popovers. */}
        {clearedTiles.length > 0 && (
          <Box>
            <SectionHeading
              title="Race log"
              summary={
                <Text size="2" className="text-gray-500">
                  {clearedTiles.length} tiles cleared
                </Text>
              }
            />
            <Table.Root size="2" mt="2">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell className="w-20 text-osrs-orange">
                    Date
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="text-osrs-orange">
                    Team
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell
                    justify="end"
                    className="w-14 text-osrs-orange"
                  >
                    {tiered ? 'Tier' : 'Tile'}
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="text-osrs-orange">
                    Task
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                    Submitted by
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {[...clearedTiles].reverse().map(({ team, entry }, i) => (
                  <Table.Row
                    key={`${team.teamId}-${entry.tileIndex}-${i}`}
                    className={zebraStripeClass}
                  >
                    <Table.Cell>
                      <Text
                        size="2"
                        className="whitespace-nowrap text-gray-500"
                      >
                        {historyDate(entry.completedAt) ?? ''}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <TeamToken
                          name={team.name}
                          color={colorByTeamId[team.teamId]}
                          size="sm"
                        />
                        <Text
                          size="2"
                          className="hidden text-gray-100 sm:inline"
                        >
                          {team.name}
                        </Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell justify="end">
                      <Text size="2" className="text-gray-400">
                        {entry.isFinish ? '' : entry.tier ?? entry.tileIndex}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {entry.isFinish ? (
                        <Text size="2" className="text-osrs-gold">
                          Crossed the line {ordinal(team.place ?? 0)}
                        </Text>
                      ) : (
                        <Text size="2" className="text-gray-200">
                          {tileNameByIndex(entry.tileIndex)}
                          {entry.note && (
                            <span className="text-gray-400">
                              {' '}
                              “{entry.note}”
                            </span>
                          )}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell className="hidden md:table-cell">
                      <Text size="2" className="text-sanguine-bright">
                        {entry.submittedBy ?? ''}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Flex>

      {/* Full team roster, opened from the standings' member counts */}
      <Dialog.Root
        open={rosterTeam !== null}
        onOpenChange={open => !open && setRosterTeam(null)}
      >
        {rosterTeam && (
          <Dialog.Content size="2" className="max-w-[480px]">
            <Dialog.Title>
              <Flex align="center" gap="2">
                <TeamToken
                  name={rosterTeam.name}
                  color={colorByTeamId[rosterTeam.teamId]}
                  size="sm"
                />
                <span className="font-normal text-gray-100">
                  {rosterTeam.name}
                </span>
              </Flex>
            </Dialog.Title>
            <Dialog.Description size="2" className="text-gray-500">
              {rosterTeam.memberNames.length} members ·{' '}
              {tiered
                ? `tier ${Math.min(rosterTeam.tier ?? 0, tierSizes.length)} of ${tierSizes.length}`
                : `tile ${rosterTeam.tileIndex} of ${rosterTeam.finishIndex}`}{' '}
              · {statusText(rosterTeam)}
            </Dialog.Description>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {rosterTeam.memberNames.map((memberName, i) => (
                <Text
                  key={`${memberName}-${i}`}
                  size="2"
                  className="truncate text-sanguine-bright"
                  title={memberName}
                >
                  {memberName}
                </Text>
              ))}
            </div>
          </Dialog.Content>
        )}
      </Dialog.Root>
    </Box>
  );
}
