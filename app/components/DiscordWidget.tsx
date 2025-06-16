import { Box, Button, Flex, Heading, Text } from '@radix-ui/themes';

interface DiscordWidgetProps {
  title?: string;
  description?: string;
  showButtons?: boolean;
}

export function DiscordWidget({
  title = 'Join Our Discord Community',
  description = 'Connect with fellow clan members, participate in events, and stay updated on all clan activities',
  showButtons = true,
}: DiscordWidgetProps) {
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
          <img
            src="https://invidget.switchblade.xyz/sanguine"
            alt="Discord Invite"
            className="rounded-lg"
          />
        </a>

        {showButtons && (
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
        )}
      </Flex>
    </Box>
  );
}
