import { Box, Heading, Text } from '@radix-ui/themes';

interface IArticleTitleProps {
  title: string;
  tagline?: string;
}

/**
 * Wiki-article title block: the subject's name over a gray hairline with the
 * records tagline beneath it. Opens every article-style detail page.
 */
export function ArticleTitle({
  title,
  tagline = 'From the records of Sanguine',
}: IArticleTitleProps) {
  return (
    <Box className="border-b border-gray-700 pb-2">
      <Heading size="8" className="font-normal text-sanguine-bright">
        {title}
      </Heading>
      <Text as="p" size="2" className="mt-1 text-gray-500">
        {tagline}
      </Text>
    </Box>
  );
}
