import { Box, Flex, Text } from '@radix-ui/themes';
import dayjs from 'dayjs';

export interface IClogUnlock {
  name: string;
  icon: string;
  date: string;
}

interface IClogUnlockRowProps {
  unlock: IClogUnlock;
}

/**
 * One collection log unlock in a feed — item icon, white name, then the date
 * right-aligned. (Attributed clan-wide feeds use ClogUnlockStrip instead.)
 */
export function ClogUnlockRow({ unlock }: IClogUnlockRowProps) {
  return (
    <Box className="border-b border-gray-800 py-2 last:border-b-0">
      <Flex align="center" gap="3">
        <Box className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
          <img
            src={unlock.icon}
            alt={unlock.name}
            className="max-h-7 max-w-7 object-contain"
          />
        </Box>
        <Flex
          gap="2"
          justify="between"
          align="center"
          className="min-w-0 flex-1"
        >
          <Text size="2" weight="medium" className="truncate text-white">
            {unlock.name}
          </Text>
          <Text
            size="2"
            className="flex-shrink-0 whitespace-nowrap text-gray-400"
          >
            {dayjs(unlock.date).format('MMM D, YYYY')}
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}
