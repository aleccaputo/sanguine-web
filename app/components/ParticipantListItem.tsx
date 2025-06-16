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
    <Flex
      justify="between"
      align="center"
      p="3"
      className="rounded-lg border border-gray-700"
    >
      <Flex align="center" gap="3">
        <Box className="w-6 text-sm text-gray-400">#{rank}</Box>
        <ClickableUserName
          user={{
            discordId: participant.discordId,
            nickname: participant.nickname,
          }}
        />
      </Flex>
      <Flex align="center" gap="4">
        <Box className="text-right">
          <Text size="2" className="block text-gray-400">
            {isSkill ? 'XP Gained' : 'Kills'}
          </Text>
          <Text size="3" className="block font-bold text-green-400">
            {isSkill ? participant.gained.toLocaleString() : participant.gained}
          </Text>
        </Box>
        <Box className="text-right">
          <Text size="2" className="block text-gray-400">
            Points Earned
          </Text>
          <Text size="3" className="block font-bold text-sanguine-red">
            {participant.totalPoints}
          </Text>
        </Box>
      </Flex>
    </Flex>
  );
}
