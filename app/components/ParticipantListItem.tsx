import { Box, Flex, Text } from '@radix-ui/themes';
import { ClickableUserName } from './ClickableUserName';
import { useNavigate } from '@remix-run/react';

interface Participant {
  nickname: string;
  discordId: string;
  gained: number;
  totalPoints: number;
}

interface ParticipantListItemProps {
  participant: Participant;
  rank: number;
  metric: string;
}

export function ParticipantListItem({
  participant,
  rank,
  metric,
}: ParticipantListItemProps) {
  const navigate = useNavigate();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/users/${participant.discordId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/users/${participant.discordId}`);
        }
      }}
      className="cursor-pointer rounded-lg border border-gray-700 p-3 transition-colors hover:border-sanguine-red hover:bg-gray-800/30"
    >
      {/* Mobile Layout */}
      <div className="flex flex-col gap-3 sm:hidden">
        <Flex align="center" gap="3">
          <Box className="w-6 flex-shrink-0 whitespace-nowrap text-sm text-gray-400">#{rank}</Box>
          <ClickableUserName
            user={{
              discordId: participant.discordId,
              nickname: participant.nickname,
            }}
          />
        </Flex>
        <Flex justify="between" gap="4">
          <Box className="flex-1 text-center">
            <Text size="1" className="block text-gray-400">
              {metric ? 'XP Gained' : 'Kills'}
            </Text>
            <Text size="2" className="block font-bold text-green-400">
              {metric
                ? participant.gained.toLocaleString()
                : participant.gained}
            </Text>
          </Box>
          <Box className="flex-1 text-center">
            <Text size="1" className="block text-gray-400">
              Points Earned
            </Text>
            <Text size="2" className="block font-bold text-sanguine-red">
              {participant.totalPoints}
            </Text>
          </Box>
        </Flex>
      </div>

      {/* Desktop Layout */}
      <Flex justify="between" align="center" className="hidden sm:flex">
        <Flex align="center" gap="3" className="min-w-0 flex-1">
          <Box className="w-6 flex-shrink-0 whitespace-nowrap text-sm text-gray-400">#{rank}</Box>
          <ClickableUserName
            user={{
              discordId: participant.discordId,
              nickname: participant.nickname,
            }}
          />
        </Flex>
        <Flex align="center" gap="6" className="flex-shrink-0">
          <Box className="min-w-[80px] text-right">
            <Text size="1" className="block text-gray-400">
              {metric}
            </Text>
            <Text size="3" className="block font-bold text-green-400">
              {metric
                ? participant.gained.toLocaleString()
                : participant.gained}
            </Text>
          </Box>
          <Box className="min-w-[80px] text-right">
            <Text size="1" className="block text-gray-400">
              Points Earned
            </Text>
            <Text size="3" className="block font-bold text-sanguine-red">
              {participant.totalPoints}
            </Text>
          </Box>
        </Flex>
      </Flex>
    </div>
  );
}
