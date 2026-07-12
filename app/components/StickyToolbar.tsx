import { Box, Flex } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';

interface IStickyToolbarProps {
  children: ReactNode;
}

/**
 * Sticky filter bar that rides below the fixed 73px navbar: solid background
 * (never backdrop-blur), full-bleed to the container's edges, one hairline
 * beneath. Put a SearchInput and at most one Select filter inside.
 */
export function StickyToolbar({ children }: IStickyToolbarProps) {
  return (
    <Box className="sticky top-[73px] z-10 -mx-4 border-b border-gray-800 bg-[#111113] px-4 py-3 sm:-mx-6 sm:px-6">
      <Flex gap="2" align="center" wrap="wrap">
        {children}
      </Flex>
    </Box>
  );
}

interface ISearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Bordered search input whose frame reddens on focus. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className = 'w-60',
}: ISearchInputProps) {
  return (
    <Flex
      gap="2"
      align="center"
      className={`${className} rounded-sm border border-gray-800 bg-gray-900 px-3 py-1.5 focus-within:border-sanguine-red`}
    >
      <MagnifyingGlassIcon
        height="14"
        width="14"
        className="shrink-0 text-gray-500"
      />
      <input
        type="text"
        className="w-full bg-transparent text-white outline-none placeholder:text-gray-500"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </Flex>
  );
}
