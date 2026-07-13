import { Flex, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

interface ISectionHeadingProps {
  title: ReactNode;
  summary?: ReactNode;
}

/**
 * Section h2 over its rule, with a gray/gold summary right-aligned on the same
 * baseline. The h2 owns the section's one divider — subsections below it stay
 * bare (see SubsectionHeading).
 */
export function SectionHeading({ title, summary }: ISectionHeadingProps) {
  return (
    <Flex
      align="baseline"
      justify="between"
      gap="3"
      wrap="wrap"
      className="border-b border-gray-700 pb-1"
    >
      <Heading size="5" className="font-normal text-gray-100">
        {title}
      </Heading>
      {summary}
    </Flex>
  );
}

interface ISubsectionHeadingProps {
  title: string;
  hint?: string;
  summary?: ReactNode;
  id?: string;
}

/**
 * Subsection h3: bare osrs-orange text (no rule — the h2 already drew one),
 * with an optional gray hint that hides on mobile and a right-aligned summary.
 * Render these only when a section has ≥2 subsections to divide.
 */
export function SubsectionHeading({
  title,
  hint,
  summary,
  id,
}: ISubsectionHeadingProps) {
  return (
    <Flex
      id={id}
      align="baseline"
      justify="between"
      gap="3"
      className={id ? 'scroll-mt-20 pb-1 pt-2' : 'pb-1 pt-2'}
    >
      <Text size="3" className="text-osrs-orange">
        {title}
        {hint && (
          <>
            {' '}
            <span className="hidden text-gray-600 sm:inline">{hint}</span>
          </>
        )}
      </Text>
      {summary}
    </Flex>
  );
}
