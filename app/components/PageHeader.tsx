import { Box, Flex, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

interface IPageHeaderProps {
  title: string;
  iconSrc?: string;
  children?: ReactNode;
}

/**
 * List-page header: 44px game icon beside the red page title, over a prose
 * summary line that narrates the page's numbers (pass colored spans per the
 * color grammar — red = members, white = drop points, gold = clan points/gp).
 */
export function PageHeader({ title, iconSrc, children }: IPageHeaderProps) {
  return (
    <Box mb="6">
      <Flex align="center" gap="3">
        {iconSrc && <img src={iconSrc} alt="" width={44} height={44} />}
        <Heading size="8" className="font-normal text-sanguine-bright">
          {title}
        </Heading>
      </Flex>
      {children && (
        <Text as="p" size="3" className="mt-2 text-gray-400">
          {children}
        </Text>
      )}
    </Box>
  );
}
