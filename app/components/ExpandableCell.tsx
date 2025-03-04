import { Box, Text } from '@radix-ui/themes';
import { useState } from 'react';

const ExpandableCell = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxDisplayItems = 3;
  const itemsList = content.split(', ');

  if (itemsList.length <= maxDisplayItems) {
    return <Text>{content}</Text>;
  }

  return (
    <Box onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
      <Text size="2">
        {isExpanded
          ? content
          : `${itemsList.slice(0, maxDisplayItems).join(', ')}... (${itemsList.length - maxDisplayItems} more)`}
      </Text>
      <Text size="1" className="ml-1 text-sanguine-red group-hover:text-white">
        {isExpanded ? '(collapse)' : '(expand)'}
      </Text>
    </Box>
  );
};

export { ExpandableCell };
