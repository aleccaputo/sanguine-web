import { Flex, Text } from '@radix-ui/themes';

/**
 * The clan's Discord invite as a flat, square, house-themed card — no
 * third-party embed to wait on. The whole card is the link.
 */
export function DiscordWidget() {
  return (
    <a
      href="https://discord.gg/sanguine"
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex max-w-full items-center gap-4 rounded-sm border border-gray-700 bg-gray-900 py-3 pl-4 pr-3 transition-colors hover:border-sanguine-red"
    >
      <img
        src="/sanguine_icon_small.png"
        alt=""
        width={40}
        height={40}
        className="shrink-0 [image-rendering:pixelated]"
      />
      <Flex direction="column" className="min-w-0">
        <Text size="3" className="text-white">
          Sanguine Discord
        </Text>
        <Text size="2" className="truncate text-gray-400">
          discord.gg/sanguine
          <span className="hidden sm:inline">
            {' '}
            · applications and clan chat
          </span>
        </Text>
      </Flex>
      <span className="ml-2 shrink-0 rounded-sm bg-sanguine-red px-4 py-2 text-white transition-colors group-hover:bg-[#9a231c]">
        Join
      </span>
    </a>
  );
}
