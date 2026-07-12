import { Box, Flex, Text } from '@radix-ui/themes';
import { useState } from 'react';

/**
 * Discord invite embed with a join button — flat and square, left-aligned so
 * it sits inside a section; the surrounding page narrates the pitch.
 */
export function DiscordWidget() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Flex direction="column" align="start" gap="4">
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
            className={`rounded-sm transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}

        {!imageLoaded && !imageError && (
          <Box className="flex h-24 w-80 max-w-full items-center justify-center rounded-sm border border-gray-800 bg-gray-900">
            <Text size="2" className="text-gray-400">
              Loading Discord preview...
            </Text>
          </Box>
        )}

        {imageError && (
          <Box className="flex h-24 w-80 max-w-full items-center justify-center rounded-sm border border-gray-800 bg-gray-900">
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
        className="rounded-sm bg-sanguine-red px-4 py-2 text-white transition-colors hover:bg-[#9a231c]"
      >
        Join Discord
      </a>
    </Flex>
  );
}
