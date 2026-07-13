import { Box, Text } from '@radix-ui/themes';
import { Link } from '@remix-run/react';
import { proseLinkClass } from '~/utils/styles';

interface ICategoriesFooterProps {
  to: string;
  primaryLabel: string;
  categories: string[];
}

/**
 * Wiki-style "Categories:" footer strip, generated from the record — the
 * primary category links back to its list page, the rest read as plain tags.
 */
export function CategoriesFooter({
  to,
  primaryLabel,
  categories,
}: ICategoriesFooterProps) {
  return (
    <Box mt="8" className="border border-gray-800 bg-gray-900 px-4 py-2">
      <Text as="p" size="2" className="text-gray-500">
        Categories:{' '}
        <Link to={to} className={proseLinkClass}>
          {primaryLabel}
        </Link>
        {categories.map(category => (
          <span key={category} className="text-gray-400">
            {' | '}
            {category}
          </span>
        ))}
      </Text>
    </Box>
  );
}
