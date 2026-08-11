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
import { Box, Button, Flex, Select, Table, Text } from '@radix-ui/themes';
import { requireStaff } from '~/services/auth.server';
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
  startRace,
  endRace,
} from '~/services/events-admin-service.server';
import {
  getGuildTextChannels,
  IGuildTextChannel,
} from '~/services/discord-admin-service.server';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import {
  BOARD_SCRIPT_PLACEHOLDER,
  parseBoardScript,
} from '~/utils/tile-race-board';
import { Input } from '~/components/input';
import { Label } from '~/components/label';
import { SectionHeading } from '~/components/SectionHeading';
import { EmptyState } from '~/components/EmptyState';
import { zebraStripeClass } from '~/utils/styles';

export const meta: MetaFunction = () => [{ title: 'Events Admin — Tile Race' }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireStaff(request);
  try {
    const race = await getAdminRace(user.discordId);
    // Channels feed the create form's pickers and name the dashboard's channel refs;
    // a Discord API hiccup degrades to raw ids rather than failing the page.
    const channels = await getGuildTextChannels().catch(
      () => [] as IGuildTextChannel[],
    );
    return json({ race, channels, apiError: null as string | null });
  } catch (e) {
    const message =
      e instanceof EventsApiError ? e.message : 'Events API is unreachable';
    return json({
      race: null as IAdminTileRace | null,
      channels: [] as IGuildTextChannel[],
      apiError: message,
    });
  }
}

// Turns the members field (nicknames or raw Discord ids, one per line or
// comma-separated) into Discord ids via the same roster the rest of the site uses.
const resolveMemberIds = async (
  input: string,
): Promise<{ ids: string[]; unknown: string[] }> => {
  const tokens = [
    ...new Set(
      input
        .split(/[\n,]/)
        .map(token => token.trim())
        .filter(Boolean),
    ),
  ];
  const users = await getUsersWithNicknames();
  const idByNickname = new Map(
    users.map(user => [user.nickname?.toLocaleLowerCase() ?? '', user.discordId]),
  );
  const resolved = tokens.map(token => ({
    token,
    id: /^\d{5,25}$/.test(token)
      ? token
      : idByNickname.get(token.toLocaleLowerCase()),
  }));
  return {
    ids: [...new Set(resolved.flatMap(r => (r.id ? [r.id] : [])))],
    unknown: resolved.filter(r => !r.id).map(r => r.token),
  };
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireStaff(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent'));
  const teamName = String(formData.get('team') ?? '').trim();

  try {
    switch (intent) {
      case 'create': {
        const board = parseBoardScript(String(formData.get('board') ?? ''));
        if (!board.ok) {
          return json({ intent, errors: board.errors }, { status: 400 });
        }
        await createRace(
          {
            name: String(formData.get('name') ?? '').trim(),
            diceSides: Number(formData.get('diceSides') ?? 6),
            tiles: board.tiles,
            approvalsChannelId: String(formData.get('approvalsChannelId') ?? ''),
            announcementsChannelId: String(
              formData.get('announcementsChannelId') ?? '',
            ),
            days: Number(formData.get('days') ?? 14),
          },
          user.discordId,
        );
        return json({ intent, errors: null });
      }
      case 'addteam': {
        const { ids, unknown } = await resolveMemberIds(
          String(formData.get('members') ?? ''),
        );
        if (unknown.length) {
          return json(
            {
              intent,
              errors: [`Unknown members: ${unknown.join(', ')}`],
            },
            { status: 400 },
          );
        }
        await addTeam(String(formData.get('name') ?? '').trim(), ids, user.discordId);
        return json({ intent, errors: null });
      }
      case 'removeteam':
        await removeTeam(teamName, user.discordId);
        return json({ intent, errors: null });
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
    throw e;
  }
}

export default function AdminTileRace() {
  const { race, channels, apiError } = useLoaderData<typeof loader>();

  if (apiError) {
    return (
      <Box>
        <SectionHeading title="Tile race" />
        <Text as="p" size="3" className="mt-4 text-red-400">
          {apiError}. Is the events API running?
        </Text>
      </Box>
    );
  }

  return race ? (
    <RaceDashboard race={race} channels={channels} />
  ) : (
    <CreateRaceForm channels={channels} />
  );
}

const fieldClass = 'flex flex-col gap-1.5';

function CreateRaceForm({ channels }: { channels: IGuildTextChannel[] }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  return (
    <Box className="max-w-2xl">
      <SectionHeading title="New tile race" summary="no race is currently open" />
      <Form method="post" className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="intent" value="create" />
        <div className={fieldClass}>
          <Label htmlFor="name">Event name</Label>
          <Input id="name" name="name" required maxLength={100} placeholder="Sanguine Tile Race III" />
        </div>
        <Flex gap="4" wrap="wrap">
          <div className={fieldClass}>
            <Label htmlFor="diceSides">Dice sides</Label>
            <Input
              id="diceSides"
              name="diceSides"
              type="number"
              min={2}
              max={20}
              defaultValue={6}
              className="w-24"
            />
          </div>
          <div className={fieldClass}>
            <Label htmlFor="days">Planned days</Label>
            <Input
              id="days"
              name="days"
              type="number"
              min={1}
              max={90}
              defaultValue={14}
              className="w-24"
            />
          </div>
        </Flex>
        <Flex gap="4" wrap="wrap">
          <div className={fieldClass}>
            <Label htmlFor="approvalsChannelId">Approvals channel (private)</Label>
            <ChannelSelect name="approvalsChannelId" channels={channels} />
          </div>
          <div className={fieldClass}>
            <Label htmlFor="announcementsChannelId">Announcements channel (public)</Label>
            <ChannelSelect name="announcementsChannelId" channels={channels} />
          </div>
        </Flex>
        <div className={fieldClass}>
          <Label htmlFor="board">Board</Label>
          <textarea
            id="board"
            name="board"
            required
            rows={14}
            placeholder={BOARD_SCRIPT_PLACEHOLDER}
            className="rounded-sm border border-gray-700 bg-gray-900 p-2 text-sm text-gray-100 placeholder:text-gray-600"
          />
          <Text size="1" className="text-gray-500">
            One tile per line: <span className="text-gray-300">TASK name | description</span>,{' '}
            <span className="text-sky-400">FWD n</span>,{' '}
            <span className="text-red-400">BACK n</span>. Lines starting with # are
            ignored. START and FINISH are added automatically.
          </Text>
        </div>
        {actionData?.intent === 'create' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
        <Button size="3" type="submit" disabled={submitting} className="w-fit cursor-pointer">
          {submitting ? 'Creating…' : 'Create race (draft)'}
        </Button>
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
}: {
  race: IAdminTileRace;
  channels: IGuildTextChannel[];
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
        <Text as="p" size="3" className="mt-2 text-gray-400">
          <span className="text-gray-100">{board.tileCount}</span> tiles, d
          <span className="text-gray-100">{board.diceSides}</span>. Approvals in{' '}
          <span className="text-gray-100">
            {channelName(race.channels.approvalsChannelId)}
          </span>
          , announcements in{' '}
          <span className="text-gray-100">
            {channelName(race.channels.announcementsChannelId)}
          </span>
          .
          The public page is{' '}
          <Link to="/tile-race" className="text-sanguine-bright hover:text-white">
            /tile-race
          </Link>
          .
        </Text>
        {event.status === 'DRAFT' && (
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="start" />
            <Button size="2" type="submit" disabled={submitting} className="cursor-pointer">
              Start race — roll first tasks
            </Button>
          </Form>
        )}
        {actionData?.intent === 'start' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
      </Box>

      <Box>
        <SectionHeading title="Teams" summary={`${standings.length} teams`} />
        {standings.length === 0 ? (
          <EmptyState>No teams yet — add the first one below.</EmptyState>
        ) : (
          <Table.Root size="2" mt="2">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className="text-osrs-orange">Team</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end" className="text-osrs-orange">Tile</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="hidden text-osrs-orange md:table-cell">
                  Current task
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-osrs-orange">Overrides</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {standings.map(standing => (
                <TeamRow
                  key={standing.teamId}
                  standing={standing}
                  raceStatus={event.status}
                />
              ))}
            </Table.Body>
          </Table.Root>
        )}
        <AddTeamForm />
      </Box>

      <Box>
        <SectionHeading title="Danger zone" />
        <Flex gap="3" mt="3">
          <Form
            method="post"
            onSubmit={e => {
              if (!confirm('End the race and post final standings?')) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="end" />
            <Button size="2" color="amber" variant="soft" type="submit" className="cursor-pointer">
              End race
            </Button>
          </Form>
          <Form
            method="post"
            onSubmit={e => {
              if (!confirm('Cancel the race? Progress stays in the database but the race is over.'))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="cancel" />
            <Button size="2" color="red" variant="soft" type="submit" className="cursor-pointer">
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
}: {
  standing: IAdminTileRace['standings'][number];
  raceStatus: IAdminTileRace['event']['status'];
}) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== 'idle';
  const raceRunning = raceStatus === 'ACTIVE';

  return (
    <Table.Row className={zebraStripeClass}>
      <Table.Cell>
        <Text size="2" className="text-gray-100">
          {standing.name}
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
          {standing.isFinished ? '🏁 Finished' : (standing.currentTask ?? '—')}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Flex gap="2" align="center" wrap="wrap">
          {raceRunning && !standing.isFinished && (
            <>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="complete" />
                <input type="hidden" name="team" value={standing.name} />
                <Button size="1" variant="soft" type="submit" disabled={busy} className="cursor-pointer">
                  Complete task
                </Button>
              </fetcher.Form>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="reroll" />
                <input type="hidden" name="team" value={standing.name} />
                <Button size="1" variant="soft" type="submit" disabled={busy} className="cursor-pointer">
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
                  className="h-6 w-16 px-1 py-0 text-xs"
                />
                <Button size="1" variant="soft" type="submit" disabled={busy} className="cursor-pointer">
                  Move
                </Button>
              </fetcher.Form>
            </>
          )}
          <fetcher.Form
            method="post"
            onSubmit={e => {
              if (!confirm(`Remove ${standing.name} and all of its progress?`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="removeteam" />
            <input type="hidden" name="team" value={standing.name} />
            <Button size="1" color="red" variant="soft" type="submit" disabled={busy} className="cursor-pointer">
              Remove
            </Button>
          </fetcher.Form>
        </Flex>
        {fetcher.data?.errors && <ActionErrors errors={fetcher.data.errors} />}
      </Table.Cell>
    </Table.Row>
  );
}

function AddTeamForm() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  return (
    <Box mt="4" className="max-w-xl">
      <Text as="p" size="3" className="text-osrs-orange">
        Add a team
      </Text>
      <Form method="post" className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="intent" value="addteam" />
        <div className={fieldClass}>
          <Label htmlFor="teamName">Team name</Label>
          <Input id="teamName" name="name" required maxLength={50} placeholder="Blood Reapers" />
        </div>
        <div className={fieldClass}>
          <Label htmlFor="members">Members — OSRS names or Discord ids, one per line</Label>
          <textarea
            id="members"
            name="members"
            required
            rows={4}
            className="rounded-sm border border-gray-700 bg-gray-900 p-2 text-sm text-gray-100 placeholder:text-gray-600"
          />
        </div>
        {actionData?.intent === 'addteam' && actionData.errors && (
          <ActionErrors errors={actionData.errors} />
        )}
        <Button size="2" type="submit" disabled={submitting} className="w-fit cursor-pointer">
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
        <Text key={error} as="p" size="2" className="text-red-400">
          {error}
        </Text>
      ))}
    </Box>
  );
}
