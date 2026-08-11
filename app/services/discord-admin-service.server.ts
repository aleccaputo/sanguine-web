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

export interface IGuildMember {
  roles: string[];
  nick: string | null;
}

export interface IGuildTextChannel {
  id: string;
  name: string;
}

const discordFetch = async (path: string): Promise<Response> =>
  fetch(`${DISCORD_API_URL}${path}`, {
    headers: { Authorization: `Bot ${botToken}` },
    signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
  });

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

/** All text channels in the server, in sidebar order. */
export const getGuildTextChannels = async (): Promise<IGuildTextChannel[]> => {
  const response = await discordFetch(`/guilds/${guildId}/channels`);
  if (!response.ok) {
    throw new Error(`Discord API returned ${response.status} fetching channels`);
  }
  const channels = (await response.json()) as {
    id: string;
    name: string;
    type: number;
    position: number;
  }[];
  return channels
    .filter(channel => channel.type === GUILD_TEXT_CHANNEL)
    .sort((a, b) => a.position - b.position)
    .map(({ id, name }) => ({ id, name }));
};
