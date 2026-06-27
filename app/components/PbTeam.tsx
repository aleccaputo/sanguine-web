import { Fragment } from 'react';
import { Link } from '@remix-run/react';
import { Text } from '@radix-ui/themes';
import { resolvePbParticipants } from '~/utils/personal-bests';

// Medal for the top three, plain ordinal afterwards. Shared by the leaderboard and profile tables.
export const rankBadge = (rank: number): string =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

interface IPbTeamProps {
  participantDiscordIds: string[];
  // discordId -> main nickname. Missing ids render as "Unknown" and aren't linked.
  nameByDiscordId: Record<string, string>;
  // Index-aligned with participantDiscordIds: the alt a participant ran on, or '' for their main.
  participantAltNames?: string[];
}

// Renders a PB's roster as comma-separated member links, alphabetised so the same team always
// reads identically regardless of submission order. An alt account is shown as "Alt (Main)" — the
// same convention used for drops (see resolvePbParticipants / formatAccountWithMain).
export function PbTeam({
  participantDiscordIds,
  nameByDiscordId,
  participantAltNames,
}: IPbTeamProps) {
  const members = resolvePbParticipants(
    participantDiscordIds,
    participantAltNames ?? [],
    nameByDiscordId,
  ).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Text size="2" className="text-gray-300">
      {members.map((member, index) => (
        <Fragment key={member.discordId}>
          {member.isMember ? (
            <Link
              to={`/users/${member.discordId}`}
              className="text-gray-300 transition-colors hover:text-sanguine-red"
            >
              {member.displayName}
            </Link>
          ) : (
            member.displayName
          )}
          {index < members.length - 1 && ', '}
        </Fragment>
      ))}
    </Text>
  );
}
