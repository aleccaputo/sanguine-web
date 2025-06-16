import { Box, Flex, Text } from '@radix-ui/themes';
import { ClickableUserName } from './ClickableUserName';

interface Participant {
  nickname: string;
  discordId: string;
  gained: number;
  totalPoints: number;
}

interface ParticipantListItemProps {
  participant: Participant;
  rank: number;
  isSkill: boolean;
}

export function ParticipantListItem({
  participant,
  rank,
  isSkill,
}: ParticipantListItemProps) {
  return (
    <div className="rounded-lg border border-gray-700 p-3">
      {/* Mobile Layout */}
      <div className="flex flex-col gap-3 sm:hidden">
        <Flex align="center" gap="3">
          <Box className="w-6 text-sm text-gray-400 flex-shrink-0">#{rank}</Box>
          <ClickableUserName
            user={{
              discordId: participant.discordId,
              nickname: participant.nickname,
            }}
          />
        </Flex>
        <Flex justify="between" gap="4">
          <Box className="text-center flex-1">
            <Text size="1" className="block text-gray-400">
              {isSkill ? 'XP Gained' : 'Kills'}
            </Text>
            <Text size="2" className="block font-bold text-green-400">
              {isSkill ? participant.gained.toLocaleString() : participant.gained}
            </Text>
          </Box>
          <Box className="text-center flex-1">
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
      <Flex
        justify="between"
        align="center"
        className="hidden sm:flex"
      >
        <Flex align="center" gap="3" className="min-w-0 flex-1">
          <Box className="w-6 text-sm text-gray-400 flex-shrink-0">#{rank}</Box>
          <ClickableUserName
            user={{
              discordId: participant.discordId,
              nickname: participant.nickname,
            }}
          />
        </Flex>
        <Flex align="center" gap="6" className="flex-shrink-0">
          <Box className="text-right min-w-[80px]">
            <Text size="1" className="block text-gray-400">
              {isSkill ? 'XP Gained' : 'Kills'}
            </Text>
            <Text size="3" className="block font-bold text-green-400">
              {isSkill ? participant.gained.toLocaleString() : participant.gained}
            </Text>
          </Box>
          <Box className="text-right min-w-[80px]">
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
