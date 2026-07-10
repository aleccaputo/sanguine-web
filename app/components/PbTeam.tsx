import { Fragment } from 'react';
import { Link } from '@remix-run/react';
import { Text } from '@radix-ui/themes';
import {
  IMPRECISE_PB_PENALTY_SECONDS,
  resolvePbParticipants,
} from '~/utils/personal-bests';

// Medal for the top three, plain ordinal afterwards. Shared by the leaderboard and profile tables.
export const rankBadge = (rank: number): string =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

interface IPbTimeProps {
  timeDisplay: string;
  isPreciseTime: boolean;
}

// A PB time. A time submitted without a decimal shows its assumed worst case (e.g. "0:55.40*",
// two decimal digits to match precise times) so the column reads uniformly. The "*" is
// deliberately unexplained. toFixed avoids float noise (0.4 * 100 !== 40 in JS).
export function PbTime({ timeDisplay, isPreciseTime }: IPbTimeProps) {
  if (isPreciseTime) {
    return <>{timeDisplay}</>;
  }
  return (
    <>
      {timeDisplay}.{IMPRECISE_PB_PENALTY_SECONDS.toFixed(2).slice(2)}
      <span className="text-gray-400">*</span>
    </>
  );
}

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
              className="text-gray-300 transition-colors hover:text-sanguine-bright"
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
