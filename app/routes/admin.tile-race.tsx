import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Box, Flex, Select, Table, Text } from '@radix-ui/themes';
import { Button } from '~/components/button';
import { requireStaff } from '~/services/auth.server';
import { audit } from '~/services/audit.server';
import {
  addTeam,
  cancelRace,
  completeTeamTask,
  createRace,
  EventsApiError,
  getAdminRace,
  IAdminTileRace,
  moveTeam,
  removeTeam,
  rerollTeam,
  rescheduleRace,
  startRace,
  endRace,
  updateBoard,
  updateTeam,
} from '~/services/events-admin-service.server';
import {
  getGuildTextChannels,
  IGuildTextChannel,
} from '~/services/discord-admin-service.server';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { IBoardTileInput, toBoardTileInputs } from '~/utils/tile-race-board';
import { Input } from '~/components/input';
import { Label } from '~/components/label';
import { IPickerMember, MemberPicker } from '~/components/MemberPicker';
import { TileRaceBoardBuilder } from '~/components/TileRaceBoardBuilder';
import { SectionHeading } from '~/components/SectionHeading';
import { EmptyState } from '~/components/EmptyState';
import { zebraStripeClass } from '~/utils/styles';

export const meta: MetaFunction = () => [{ title: 'Events Admin — Tile Race' }];

// The clan roster feeding the member typeahead — same source the rest of the
// site uses for nickname resolution.
const getRoster = async (): Promise<IPickerMember[]> => {
  const users = await getUsersWithNicknames();
  return users
    .flatMap(user =>
      user.nickname
        ? [{ discordId: user.discordId, nickname: user.nickname }]
        : [],
    )
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  try {
    const race = await getAdminRace();
    // Channels feed the create form's pickers and name the dashboard's channel refs;
    // a Discord API hiccup degrades to raw ids rather than failing the page. Same
    // spirit for the roster: no roster just means the typeahead only takes raw ids.
    const channels = await getGuildTextChannels().catch(
      () => [] as IGuildTextChannel[],
    );
    const members = await getRoster().catch(() => [] as IPickerMember[]);
    return json({ race, channels, members, apiError: null as string | null });
  } catch (e) {
    const message =
      e instanceof EventsApiError ? e.message : 'Events API is unreachable';
    return json({
      race: null as IAdminTileRace | null,
      channels: [] as IGuildTextChannel[],
      members: [] as IPickerMember[],
      apiError: message,
    });
  }
}

// The MemberPicker submits its selection as a JSON array of Discord ids.
const parseMemberIds = (raw: string): string[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
      parsed.every(
        (id): id is string => typeof id === 'string' && /^\d{5,25}$/.test(id),
      )
      ? parsed
      : null;
  } catch {
    return null;
  }
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireStaff(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent'));
  const teamName = String(formData.get('team') ?? '').trim();

  // Attempts are audited, not just successes — a rejected override is still an
  // action someone took. The events API logs its own side under the same actor.
  audit('admin.action', {
    area: 'tile-race',
    intent,
    ...(teamName ? { team: teamName } : {}),
    discordId: user.discordId,
    username: user.username,
  });

  try {
    switch (intent) {
      case 'create': {
        let tiles: IBoardTileInput[];
        try {
          tiles = JSON.parse(String(formData.get('board') ?? ''));
        } catch {
          return json(
            { intent, errors: ['The board payload was malformed.'] },
            { status: 400 },
          );
        }
        if (!Array.isArray(tiles) || !tiles.length) {
          return json(
            { intent, errors: ['Add at least one tile to the board.'] },
            { status: 400 },
          );
        }
        await createRace(
          {
            name: String(formData.get('name') ?? '').trim(),
            diceSides: Number(formData.get('diceSides') ?? 6),
            tiles,
            approvalsChannelId: String(
              formData.get('approvalsChannelId') ?? '',
            ),
            announcementsChannelId: String(
              formData.get('announcementsChannelId') ?? '',
            ),
            days: Number(formData.get('days') ?? 14),
          },
          user.discordId,
        );
        return json({ intent, errors: null });
      }
      case 'updateboard': {
        let tiles: IBoardTileInput[];
        try {
          tiles = JSON.parse(String(formData.get('board') ?? ''));
        } catch {
          return json(
            { intent, errors: ['The board payload was malformed.'] },
            { status: 400 },
          );
        }
        if (!Array.isArray(tiles) || !tiles.length) {
          return json(
            { intent, errors: ['Add at least one tile to the board.'] },
            { status: 400 },
          );
        }
        await updateBoard(
          {
            diceSides: Number(formData.get('diceSides') ?? 6),
            tiles,
            version: Number(formData.get('version') ?? 0),
          },
          user.discordId,
        );
        return json({ intent, errors: null });
      }
      case 'addteam': {
        const ids = parseMemberIds(String(formData.get('members') ?? ''));
        if (!ids?.length) {
          return json(
            { intent, errors: ['Pick at least one member.'] },
            { status: 400 },
          );
        }
        await addTeam(
          String(formData.get('name') ?? '').trim(),
          ids,
          user.discordId,
        );
        return json({ intent, errors: null });
      }
      case 'editteam': {
        const ids = parseMemberIds(String(formData.get('members') ?? ''));
        const newName = String(formData.get('name') ?? '').trim();
        if (!ids?.length) {
          return json(
            { intent, errors: ['Pick at least one member.'] },
            { status: 400 },
          );
        }
        if (!newName) {
          return json(
            { intent, errors: ['Team name is required.'] },
            { status: 400 },
          );
        }
        await updateTeam(
          teamName,
          { name: newName, memberDiscordIds: ids },
          user.discordId,
        );
        return json({ intent, errors: null });
      }
      case 'removeteam':
        await removeTeam(teamName, user.discordId);
        return json({ intent, errors: null });
      case 'reschedule': {
        const days = Number(formData.get('days'));
        if (!Number.isInteger(days) || days < 1 || days > 90) {
          return json(
            { intent, errors: ['Days must be a whole number from 1 to 90.'] },
            { status: 400 },
          );
        }
        await rescheduleRace(days, user.discordId);
        return json({ intent, errors: null });
      }
      case 'start':
        await startRace(user.discordId);
        return json({ intent, errors: null });
      case 'move':
        await moveTeam(teamName, Number(formData.get('tile')), user.discordId);
        return json({ intent, errors: null });
      case 'complete':
        await completeTeamTask(teamName, user.discordId);
        return json({ intent, errors: null });
      case 'reroll':
        await rerollTeam(teamName, user.discordId);
        return json({ intent, errors: null });
      case 'end':
        await endRace(user.discordId);
        return json({ intent, errors: null });
      case 'cancel':
        await cancelRace(user.discordId);
        return json({ intent, errors: null });
      default:
        return json({ intent, errors: ['Unknown action'] }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof EventsApiError) {
      return json({ intent, errors: [e.message] }, { status: e.status });
    }
    // fetch-level failures (timeout, connection refused) never produce a Response —
    // surface them inline like API errors instead of crashing to the error boundary
    if (
      e instanceof TypeError ||
      (e instanceof Error &&
        (e.name === 'TimeoutError' || e.name === 'AbortError'))
    ) {
      return json(
        {
          intent,
          errors: ['The events API is unreachable — try again shortly.'],
        },
        { status: 503 },
      );
    }
    throw e;
  }
}

export default function AdminTileRace() {
  const { race, channels, members, apiError } = useLoaderData<typeof loader>();

  if (apiError) {
    return (
      <Box>
        <SectionHeading title="Tile race" />
        <Text as="p" size="4" className="mt-4 text-red-400">
          {apiError}. Is the events API running?
        </Text>
      </Box>
    );
  }

  return race ? (
    <RaceDashboard race={race} channels={channels} members={members} />
  ) : (
    <CreateRaceForm channels={channels} />
  );
}

const fieldClass = 'flex flex-col gap-1.5';

function CreateRaceForm({ channels }: { channels: IGuildTextChannel[] }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  const [tiles, setTiles] = useState<IBoardTileInput[]>([]);
  const boardValid =
    tiles.length > 0 &&
    tiles.every(tile => tile.type !== 'TASK' || (tile.name ?? '').trim());

  return (
    <Box>
      <SectionHeading
        title="New tile race"
        summary="no race is currently open"
      />
      <Form method="post" className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="board" value={JSON.stringify(tiles)} />
        <div className={fieldClass}>
          <Label className="text-lg" htmlFor="name">
            Event name
          </Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={100}
            className="text-lg"
            placeholder="Sanguine Tile Race III"
          />
        </div>
        <Flex gap="4" wrap="wrap">
          <div className={fieldClass}>
            <Label className="text-lg" htmlFor="diceSides">
              Dice sides
            </Label>
            <Input
              id="diceSides"
              name="diceSides"
              type="number"
              min={2}
              max={20}
              defaultValue={6}
              className="w-24 text-lg"
            />
          </div>
          <div className={fieldClass}>
            <Label className="text-lg" htmlFor="days">
              Planned days
            </Label>
            <Input
              id="days"
              name="days"
              type="number"
              min={1}
              max={90}
              defaultValue={14}
              className="w-24 text-lg"
            />
          </div>
        </Flex>
        <Flex gap="4" wrap="wrap">
          <div className={fieldClass}>
            <Label className="text-lg" htmlFor="approvalsChannelId">
              Approvals channel (private)
            </Label>
            <ChannelSelect name="approvalsChannelId" channels={channels} />
          </div>
          <div className={fieldClass}>
            <Label className="text-lg" htmlFor="announcementsChannelId">
              Announcements channel (public)
            </Label>
            <ChannelSelect name="announcementsChannelId" channels={channels} />
          </div>
        </Flex>
        <div className={fieldClass}>
          <Label>
            Board — {tiles.length} tile{tiles.length === 1 ? '' : 's'}
          </Label>
          <Text size="2" className="text-gray-500">
            Click ＋ to add a tile, click a tile to edit it. START and FINISH
            are added automatically.
          </Text>
          <TileRaceBoardBuilder tiles={tiles} onChange={setTiles} />
        </div>
        {actionData?.intent === 'create' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
        <Flex align="center" gap="3">
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={submitting || !boardValid}
            className="w-fit"
          >
            {submitting ? 'Creating…' : 'Create race (draft)'}
          </Button>
          {!boardValid && tiles.length > 0 && (
            <Text size="3" className="text-gray-500">
              Every task tile needs a name.
            </Text>
          )}
        </Flex>
      </Form>
    </Box>
  );
}

function ChannelSelect({
  name,
  channels,
}: {
  name: string;
  channels: IGuildTextChannel[];
}) {
  return (
    <Select.Root name={name} required>
      <Select.Trigger placeholder="Pick a channel" className="min-w-56" />
      <Select.Content>
        {channels.map(channel => (
          <Select.Item key={channel.id} value={channel.id}>
            #{channel.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

function RaceDashboard({
  race,
  channels,
  members,
}: {
  race: IAdminTileRace;
  channels: IGuildTextChannel[];
  members: IPickerMember[];
}) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  const { event, board, standings } = race;
  const finished = standings.filter(s => s.isFinished).length;
  const channelName = (id: string) =>
    `#${channels.find(channel => channel.id === id)?.name ?? id}`;

  return (
    <Flex direction="column" gap="6">
      <Box>
        <SectionHeading
          title={event.name}
          summary={`${event.status} · ${finished} of ${standings.length} finished`}
        />
        <Text as="p" size="4" className="mt-2 text-gray-400">
          <span className="text-gray-100">{board.tileCount}</span> tiles, d
          <span className="text-gray-100">{board.diceSides}</span>. Approvals in{' '}
          <span className="text-gray-100">
            {channelName(race.channels.approvalsChannelId)}
          </span>
          , announcements in{' '}
          <span className="text-gray-100">
            {channelName(race.channels.announcementsChannelId)}
          </span>
          . The public page is{' '}
          <Link
            to="/tile-race"
            className="text-sanguine-bright hover:text-white"
          >
            /tile-race
          </Link>
          . Runs through{' '}
          <span className="text-gray-100">
            {dayjs(event.endDate).format('MMM D, YYYY')}
          </span>
          .
        </Text>
        <Form method="post" className="mt-3 flex items-end gap-2">
          <input type="hidden" name="intent" value="reschedule" />
          <div className={fieldClass}>
            <Label className="text-lg" htmlFor="rescheduleDays">
              Planned days (from start)
            </Label>
            <Input
              id="rescheduleDays"
              name="days"
              type="number"
              min={1}
              max={90}
              defaultValue={dayjs(event.endDate).diff(
                dayjs(event.startDate),
                'day',
              )}
              className="w-24 text-lg"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            Update length
          </Button>
        </Form>
        {actionData?.intent === 'reschedule' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
        {event.status === 'DRAFT' && (
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="start" />
            <Button variant="primary" type="submit" disabled={submitting}>
              Start race — roll first tasks
            </Button>
          </Form>
        )}
        {actionData?.intent === 'start' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
      </Box>

      {event.status === 'DRAFT' && <EditBoardSection board={board} />}

      <Box>
        <SectionHeading title="Teams" summary={`${standings.length} teams`} />
        {standings.length === 0 ? (
          <EmptyState>No teams yet — add the first one below.</EmptyState>
        ) : (
          <Table.Root size="3" mt="2">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className="text-osrs-orange">
                  Team
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  justify="end"
                  className="text-osrs-orange"
                >
                  Tile
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                  Current task
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-osrs-orange">
                  Overrides
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {standings.map(standing => (
                <TeamRow
                  key={standing.teamId}
                  standing={standing}
                  raceStatus={event.status}
                  members={members}
                />
              ))}
            </Table.Body>
          </Table.Root>
        )}
        <AddTeamForm members={members} />
      </Box>

      <Box>
        <SectionHeading title="Danger zone" />
        <Flex gap="3" mt="3">
          <Form
            method="post"
            onSubmit={e => {
              if (!confirm('End the race and post final standings?'))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="end" />
            <Button variant="gold" type="submit">
              End race
            </Button>
          </Form>
          <Form
            method="post"
            onSubmit={e => {
              if (
                !confirm(
                  'Cancel the race? Progress stays in the database but the race is over.',
                )
              )
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="cancel" />
            <Button variant="danger" type="submit">
              Cancel race
            </Button>
          </Form>
        </Flex>
        {(actionData?.intent === 'end' || actionData?.intent === 'cancel') &&
          actionData.errors && <ActionErrors errors={actionData.errors} />}
      </Box>
    </Flex>
  );
}

function TeamRow({
  standing,
  raceStatus,
  members,
}: {
  standing: IAdminTileRace['standings'][number];
  raceStatus: IAdminTileRace['event']['status'];
  members: IPickerMember[];
}) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== 'idle';
  const raceRunning = raceStatus === 'ACTIVE';
  const [editing, setEditing] = useState(false);

  const nicknameById = useMemo(
    () => new Map(members.map(m => [m.discordId, m.nickname])),
    [members],
  );
  const rosterNames = standing.memberDiscordIds
    .map(id => nicknameById.get(id) ?? id)
    .join(', ');

  // Close the editor once its save lands cleanly
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.errors) {
      setEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <>
      <Table.Row className={zebraStripeClass}>
        <Table.Cell>
          <Text size="4" className="text-gray-100">
            {standing.name}
          </Text>
          {rosterNames && (
            <Text as="p" size="3" className="text-sanguine-bright">
              {rosterNames}
            </Text>
          )}
        </Table.Cell>
        <Table.Cell justify="end">
          <span className="whitespace-nowrap">
            <Text size="4" className="text-gray-100">
              {standing.tileIndex}
            </Text>
            <Text size="3" className="text-gray-600">
              {' '}
              / {standing.finishIndex}
            </Text>
          </span>
        </Table.Cell>
        <Table.Cell className="hidden md:table-cell">
          <Text size="4" className="text-gray-400">
            {standing.isFinished ? '🏁 Finished' : standing.currentTask ?? '—'}
          </Text>
        </Table.Cell>
        <Table.Cell>
          <Flex gap="2" align="center" wrap="wrap">
            {raceRunning && !standing.isFinished && (
              <>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="complete" />
                  <input type="hidden" name="team" value={standing.name} />
                  <Button type="submit" disabled={busy}>
                    Complete task
                  </Button>
                </fetcher.Form>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="reroll" />
                  <input type="hidden" name="team" value={standing.name} />
                  <Button type="submit" disabled={busy}>
                    Reroll
                  </Button>
                </fetcher.Form>
                <fetcher.Form method="post" className="flex items-center gap-1">
                  <input type="hidden" name="intent" value="move" />
                  <input type="hidden" name="team" value={standing.name} />
                  <Input
                    name="tile"
                    type="number"
                    min={1}
                    max={standing.finishIndex}
                    required
                    placeholder="tile"
                    className="h-9 w-24 px-2 py-0 text-base"
                  />
                  <Button type="submit" disabled={busy}>
                    Move
                  </Button>
                </fetcher.Form>
              </>
            )}
            <Button
              variant={editing ? 'primary' : 'default'}
              type="button"
              disabled={busy}
              onClick={() => setEditing(current => !current)}
            >
              {editing ? 'Close' : 'Edit'}
            </Button>
            <fetcher.Form
              method="post"
              onSubmit={e => {
                if (
                  !confirm(`Remove ${standing.name} and all of its progress?`)
                )
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="removeteam" />
              <input type="hidden" name="team" value={standing.name} />
              <Button variant="danger" type="submit" disabled={busy}>
                Remove
              </Button>
            </fetcher.Form>
          </Flex>
          {fetcher.data?.errors && (
            <ActionErrors errors={fetcher.data.errors} />
          )}
        </Table.Cell>
      </Table.Row>
      {editing && (
        <Table.Row>
          <Table.Cell colSpan={4} className="bg-sanguine-red/[0.04]">
            <fetcher.Form
              method="post"
              className="flex max-w-xl flex-col gap-3 py-2"
            >
              <input type="hidden" name="intent" value="editteam" />
              <input type="hidden" name="team" value={standing.name} />
              <div className={fieldClass}>
                <Label
                  className="text-lg"
                  htmlFor={`editName-${standing.teamId}`}
                >
                  Team name
                </Label>
                <Input
                  id={`editName-${standing.teamId}`}
                  name="name"
                  required
                  maxLength={50}
                  defaultValue={standing.name}
                  className="text-lg"
                />
              </div>
              <div className={fieldClass}>
                <Label
                  className="text-lg"
                  htmlFor={`editMembers-${standing.teamId}`}
                >
                  Members
                </Label>
                <MemberPicker
                  id={`editMembers-${standing.teamId}`}
                  members={members}
                  inputName="members"
                  defaultSelectedIds={standing.memberDiscordIds}
                />
              </div>
              <Button
                variant="primary"
                type="submit"
                disabled={busy}
                className="w-fit"
              >
                Save team
              </Button>
            </fetcher.Form>
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
}

// Draft races only — once the race starts, moves reference tiles by index and
// the API refuses board edits.
function EditBoardSection({ board }: { board: IAdminTileRace['board'] }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  const [tiles, setTiles] = useState<IBoardTileInput[]>(() =>
    toBoardTileInputs(board.tiles),
  );
  const boardValid =
    tiles.length > 0 &&
    tiles.every(tile => tile.type !== 'TASK' || (tile.name ?? '').trim());

  return (
    <Box>
      <SectionHeading
        title="Board"
        summary="editable until the race starts"
      />
      <Form method="post" className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="intent" value="updateboard" />
        <input type="hidden" name="board" value={JSON.stringify(tiles)} />
        {/* Version the tiles were loaded at — a concurrent save 409s instead of clobbering */}
        <input type="hidden" name="version" value={board.version ?? 0} />
        <div className={fieldClass}>
          <Label className="text-lg" htmlFor="editDiceSides">
            Dice sides
          </Label>
          <Input
            id="editDiceSides"
            name="diceSides"
            type="number"
            min={2}
            max={20}
            defaultValue={board.diceSides}
            className="w-24 text-lg"
          />
        </div>
        <TileRaceBoardBuilder tiles={tiles} onChange={setTiles} />
        {actionData?.intent === 'updateboard' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
        <Flex align="center" gap="3">
          <Button
            variant="primary"
            type="submit"
            disabled={submitting || !boardValid}
            className="w-fit"
          >
            {submitting ? 'Saving…' : 'Save board'}
          </Button>
          {!boardValid && tiles.length > 0 && (
            <Text size="3" className="text-gray-500">
              Every task tile needs a name.
            </Text>
          )}
        </Flex>
      </Form>
    </Box>
  );
}

function AddTeamForm({ members }: { members: IPickerMember[] }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  return (
    <Box mt="4" className="max-w-xl">
      <Text as="p" size="4" className="text-osrs-orange">
        Add a team
      </Text>
      <Form method="post" className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="intent" value="addteam" />
        <div className={fieldClass}>
          <Label className="text-lg" htmlFor="teamName">
            Team name
          </Label>
          <Input
            id="teamName"
            name="name"
            required
            maxLength={50}
            className="text-lg"
            placeholder="Blood Reapers"
          />
        </div>
        <div className={fieldClass}>
          <Label className="text-lg" htmlFor="members">
            Members
          </Label>
          <MemberPicker id="members" members={members} inputName="members" />
        </div>
        {actionData?.intent === 'addteam' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
        <Button
          variant="primary"
          type="submit"
          disabled={submitting}
          className="w-fit"
        >
          Add team
        </Button>
      </Form>
    </Box>
  );
}

function ActionErrors({ errors }: { errors: string[] }) {
  return (
    <Box mt="2">
      {errors.map(error => (
        <Text key={error} as="p" size="4" className="text-red-400">
          {error}
        </Text>
      ))}
    </Box>
  );
}
