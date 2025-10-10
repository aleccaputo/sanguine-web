import { Link } from '@remix-run/react';
import { Box, Flex, Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import { OSRSItem } from '~/services/osrs-wiki-prices-service';

interface DropItemProps {
  item: {
    id: string;
    createdAt: string;
    pointsGiven: number;
    destinationDiscordId?: string;
    itemId?: number | null;
    osrsData?: OSRSItem | null;
  };
  nickname?: string;
  showRecipient?: boolean;
  size?: 'small' | 'large';
}

export function DropItem({
  item,
  nickname,
  showRecipient = false,
  size = 'large',
}: DropItemProps) {
  const isLarge = size === 'large';

  return (
    <Box className="border-b border-gray-800 py-2 last:border-b-0 md:py-3">
      <Flex align="center" gap={{ initial: '3', md: isLarge ? '4' : '3' }}>
        {item.osrsData?.icon && (
          <Box
            className={
              isLarge
                ? 'flex h-8 w-8 flex-shrink-0 items-center justify-center md:h-12 md:w-12'
                : 'flex h-6 w-6 flex-shrink-0 items-center justify-center'
            }
          >
            <img
              src={item.osrsData.icon}
              alt={item.osrsData.name}
              className={
                isLarge
                  ? 'max-h-8 max-w-8 object-contain md:max-h-12 md:max-w-12'
                  : 'max-h-6 max-w-6 object-contain'
              }
            />
          </Box>
        )}
        <Box className="min-w-0 flex-1">
          <Flex gap="2" justify="between" align="center">
            <Flex direction="column" gap="1" className="min-w-0">
              <Text
                size={isLarge ? { initial: '2', md: '3' } : '2'}
                weight="medium"
                className="truncate text-white"
              >
                {item.osrsData?.name ?? `Item ID: ${item.itemId}`}
              </Text>
              {showRecipient && nickname && (
                <Link
                  to={`/users/${item.destinationDiscordId}`}
                  className="text-gray-400 transition-colors hover:text-sanguine-red"
                >
                  <Text size={isLarge ? { initial: '1', md: '2' } : '1'}>
                    Received by {nickname}
                  </Text>
                </Link>
              )}
            </Flex>
            <Flex direction="column" gap="1" align="end" className="flex-shrink-0">
              <Text
                size={isLarge ? { initial: '1', md: '2' } : '1'}
                className="whitespace-nowrap text-gray-300"
              >
                {dayjs(item.createdAt).format('MMM D, YYYY')}
              </Text>
              {item.osrsData?.price && (
                <Flex align="center" gap="1">
                  <img
                    src="https://oldschool.runescape.wiki/images/Coins_detail.png"
                    alt="GP"
                    className="h-3 w-3 object-contain"
                  />
                  <Text
                    size={isLarge ? { initial: '1', md: '2' } : '1'}
                    className="text-amber-400"
                  >
                    {item.osrsData.price.toLocaleString()}
                  </Text>
                </Flex>
              )}
              <Text
                size={isLarge ? { initial: '1', md: '2' } : '1'}
                weight="medium"
                className="text-sanguine-red"
              >
                +{item.pointsGiven} pts
              </Text>
            </Flex>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
