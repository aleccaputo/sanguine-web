import * as process from 'process';
import { createCachedFetcher } from '~/utils/cached-fetcher';
import { trackOutbound } from '~/utils/outbound.server';

/**
 * Direct Discord REST calls made with the bot token (the same bot user as
 * sanguine-events). Used by the admin portal: staff-role checks at login and
 * channel pickers on the race create form.
 */
const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_TIMEOUT_MS = 8_000;
// Roles and channels change rarely, and the admin race page re-runs its loader after
// every action; a short cache keeps those revalidations off Discord entirely.
const GUILD_STRUCTURE_TTL_MS = 5 * 60 * 1000;

const botToken = process.env.DISCORD_BOT_TOKEN ?? '';
const guildId = process.env.DISCORD_SERVER_ID ?? '';

const GUILD_TEXT_CHANNEL = 0;
const ROLE_OVERWRITE = 0;
const MEMBER_OVERWRITE = 1;

const ADMINISTRATOR = 1n << 3n;
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const EMBED_LINKS = 1n << 14n;
// Everything the events bot needs to post roll/task announcements and
// approval messages (embeds + buttons) into a channel.
const REQUIRED_CHANNEL_PERMISSIONS = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS;

export interface IGuildMember {
  roles: string[];
  nick: string | null;
}

export interface IGuildTextChannel {
  id: string;
  name: string;
}

export interface IGuildRole {
  id: string;
  name: string;
}

interface IRawGuildRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  permissions: string;
}

interface IPermissionOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

interface IRawGuildChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  permission_overwrites?: IPermissionOverwrite[];
}

/** `/guilds/123/roles` → `GET /guilds/:id/roles` for the outbound metric label. */
const discordOp = (path: string): string =>
  `GET ${(path.split('?')[0] ?? path).replace(/\/\d{15,}/g, '/:id')}`;

const discordFetch = async (path: string): Promise<Response> =>
  trackOutbound('discord', discordOp(path), () =>
    fetch(`${DISCORD_API_URL}${path}`, {
      headers: { Authorization: `Bot ${botToken}` },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    }),
  );

const discordFetchJson = async <T>(path: string, what: string): Promise<T> => {
  const response = await discordFetch(path);
  if (!response.ok) {
    throw new Error(`Discord API returned ${response.status} fetching ${what}`);
  }
  return (await response.json()) as T;
};

// Both the role picker and the channel permission check read the guild's roles; one
// cached read serves both so a cold admin page costs Discord one roles call, not two.
const rawGuildRolesFetcher = createCachedFetcher(
  'discordGuildRawRoles',
  () => discordFetchJson<IRawGuildRole[]>(`/guilds/${guildId}/roles`, 'roles'),
  { ttlMs: GUILD_STRUCTURE_TTL_MS },
);

const getRawGuildRoles = (): Promise<IRawGuildRole[]> =>
  rawGuildRolesFetcher(guildId);

/** The guild member for a Discord user id, or null when they're not in the server. */
export const getGuildMember = async (
  discordId: string,
): Promise<IGuildMember | null> => {
  const response = await discordFetch(
    `/guilds/${guildId}/members/${discordId}`,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `Discord API returned ${response.status} fetching guild member`,
    );
  }
  return (await response.json()) as IGuildMember;
};

const applyOverwrite = (
  permissions: bigint,
  overwrite: IPermissionOverwrite | undefined,
): bigint =>
  overwrite
    ? (permissions & ~BigInt(overwrite.deny)) | BigInt(overwrite.allow)
    : permissions;

/**
 * Discord's permission algorithm for one channel: base role permissions, then
 * @everyone / role / member overwrites in that order. Administrator bypasses
 * overwrites entirely.
 */
const botCanPostIn = (
  channel: IRawGuildChannel,
  basePermissions: bigint,
  botUserId: string,
  botRoleIds: Set<string>,
): boolean => {
  if (basePermissions & ADMINISTRATOR) {
    return true;
  }
  const overwrites = channel.permission_overwrites ?? [];
  const roleOverwrites = overwrites.filter(
    overwrite =>
      overwrite.type === ROLE_OVERWRITE &&
      overwrite.id !== guildId &&
      botRoleIds.has(overwrite.id),
  );
  const roleAllow = roleOverwrites.reduce(
    (allow, overwrite) => allow | BigInt(overwrite.allow),
    0n,
  );
  const roleDeny = roleOverwrites.reduce(
    (deny, overwrite) => deny | BigInt(overwrite.deny),
    0n,
  );
  const withEveryone = applyOverwrite(
    basePermissions,
    overwrites.find(
      overwrite =>
        overwrite.type === ROLE_OVERWRITE && overwrite.id === guildId,
    ),
  );
  const withRoles = (withEveryone & ~roleDeny) | roleAllow;
  const permissions = applyOverwrite(
    withRoles,
    overwrites.find(
      overwrite =>
        overwrite.type === MEMBER_OVERWRITE && overwrite.id === botUserId,
    ),
  );
  return (
    (permissions & REQUIRED_CHANNEL_PERMISSIONS) ===
    REQUIRED_CHANNEL_PERMISSIONS
  );
};

/**
 * Assignable guild roles for the team-role picker, in hierarchy order (highest
 * first, matching Discord's sidebar). @everyone and managed roles (bot and
 * integration roles) are excluded — neither makes sense as a team tag.
 */
const fetchGuildRoles = async (): Promise<IGuildRole[]> => {
  const roles = await getRawGuildRoles();
  return roles
    .filter(role => role.id !== guildId && !role.managed)
    .sort((a, b) => b.position - a.position)
    .map(({ id, name }) => ({ id, name }));
};

/**
 * Text channels the bot can actually post announcements in (View Channel,
 * Send Messages, Embed Links), in sidebar order — so the race create form
 * never offers a channel that would 500 at roll time.
 */
const fetchGuildTextChannels = async (): Promise<IGuildTextChannel[]> => {
  const [channels, roles, botUser] = await Promise.all([
    discordFetchJson<IRawGuildChannel[]>(
      `/guilds/${guildId}/channels`,
      'channels',
    ),
    getRawGuildRoles(),
    discordFetchJson<{ id: string }>('/users/@me', 'bot user'),
  ]);
  const botMember = await discordFetchJson<{ roles: string[] }>(
    `/guilds/${guildId}/members/${botUser.id}`,
    'bot guild member',
  );

  const rolePermissions = new Map(
    roles.map(role => [role.id, BigInt(role.permissions)]),
  );
  const botRoleIds = new Set(botMember.roles);
  // Base permissions = @everyone (role id === guild id) OR'd with every role the bot holds
  const basePermissions = botMember.roles.reduce(
    (permissions, roleId) => permissions | (rolePermissions.get(roleId) ?? 0n),
    rolePermissions.get(guildId) ?? 0n,
  );

  return channels
    .filter(channel => channel.type === GUILD_TEXT_CHANNEL)
    .filter(channel =>
      botCanPostIn(channel, basePermissions, botUser.id, botRoleIds),
    )
    .sort((a, b) => a.position - b.position)
    .map(({ id, name }) => ({ id, name }));
};

const guildRolesFetcher = createCachedFetcher(
  'discordGuildRoles',
  fetchGuildRoles,
  { ttlMs: GUILD_STRUCTURE_TTL_MS },
);

/** Cached for a few minutes; see `fetchGuildRoles`. */
export const getGuildRoles = (): Promise<IGuildRole[]> =>
  guildRolesFetcher(guildId);

const guildTextChannelsFetcher = createCachedFetcher(
  'discordGuildTextChannels',
  fetchGuildTextChannels,
  { ttlMs: GUILD_STRUCTURE_TTL_MS },
);

/** Cached for a few minutes; see `fetchGuildTextChannels`. */
export const getGuildTextChannels = (): Promise<IGuildTextChannel[]> =>
  guildTextChannelsFetcher(guildId);
