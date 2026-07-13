import { Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

interface IEmptyStateProps {
  children?: ReactNode;
}

/**
 * Empty-state line in OSRS vernacular — pass a custom message only when the
 * default doesn't fit the screen's fiction.
 */
export function EmptyState({
  children = 'Nothing interesting happens.',
}: IEmptyStateProps) {
  return (
    <Text as="p" align="center" className="py-12 text-gray-600">
      {children}
    </Text>
  );
}
