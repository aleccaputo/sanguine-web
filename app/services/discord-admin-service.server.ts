import * as process from 'process';

/**
 * Direct Discord REST calls made with the bot token (the same bot user as
 * sanguine-events). Used by the admin portal: staff-role checks at login and
 * channel pickers on the race create form.
 */
const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_TIMEOUT_MS = 8_000;

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

const discordFetch = async (path: string): Promise<Response> =>
  fetch(`${DISCORD_API_URL}${path}`, {
    headers: { Authorization: `Bot ${botToken}` },
    signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
  });

const discordFetchJson = async <T>(path: string, what: string): Promise<T> => {
  const response = await discordFetch(path);
  if (!response.ok) {
    throw new Error(`Discord API returned ${response.status} fetching ${what}`);
  }
  return (await response.json()) as T;
};

/** The guild member for a Discord user id, or null when they're not in the server. */
export const getGuildMember = async (
  discordId: string,
): Promise<IGuildMember | null> => {
  const response = await discordFetch(`/guilds/${guildId}/members/${discordId}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Discord API returned ${response.status} fetching guild member`);
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
      overwrite => overwrite.type === ROLE_OVERWRITE && overwrite.id === guildId,
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
    (permissions & REQUIRED_CHANNEL_PERMISSIONS) === REQUIRED_CHANNEL_PERMISSIONS
  );
};

/**
 * Text channels the bot can actually post announcements in (View Channel,
 * Send Messages, Embed Links), in sidebar order — so the race create form
 * never offers a channel that would 500 at roll time.
 */
export const getGuildTextChannels = async (): Promise<IGuildTextChannel[]> => {
  const [channels, roles, botUser] = await Promise.all([
    discordFetchJson<IRawGuildChannel[]>(`/guilds/${guildId}/channels`, 'channels'),
    discordFetchJson<{ id: string; permissions: string }[]>(
      `/guilds/${guildId}/roles`,
      'roles',
    ),
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
