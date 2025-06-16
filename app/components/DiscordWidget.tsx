import { Box, Button, Flex, Heading, Text } from '@radix-ui/themes';
import { useState } from 'react';

interface DiscordWidgetProps {
  title?: string;
  description?: string;
  showButtons?: boolean;
}

export function DiscordWidget({
  title = 'Join Our Discord Community',
  description = 'Connect with fellow clan members, participate in events, and stay updated on all clan activities',
}: DiscordWidgetProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Box className="text-center">
      <Heading size="6" className="mb-4 text-white">
        {title}
      </Heading>
      <Text size="4" className="mb-6 text-gray-400">
        {description}
      </Text>

      <Flex direction="column" align="center" gap="4">
        <a
          href="https://discord.gg/sanguine"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
        >
          {!imageError && (
            <img
              src="https://invidget.switchblade.xyz/sanguine"
              alt="Discord Invite"
              className={`rounded-lg transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
          
          {!imageLoaded && !imageError && (
            <Box className="flex h-24 w-80 items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
              <Text size="2" className="text-gray-400">
                Loading Discord preview...
              </Text>
            </Box>
          )}
          
          {imageError && (
            <Box className="flex h-24 w-80 items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
              <Text size="2" className="text-gray-400">
                Discord Server Preview
              </Text>
            </Box>
          )}
        </a>

        <a
          href="https://discord.gg/sanguine"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            size="3"
            className="bg-sanguine-red hover:cursor-pointer hover:bg-red-700"
          >
            Join Discord
          </Button>
        </a>
      </Flex>
    </Box>
  );
}
