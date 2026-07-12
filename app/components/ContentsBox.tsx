import { Flex, Text } from '@radix-ui/themes';
import { useState } from 'react';
import { proseLinkClass } from '~/utils/styles';

export interface IContentsSection {
  id: string;
  title: string;
  count?: number;
  children?: { id: string; title: string }[];
}

interface IContentsBoxProps {
  sections: IContentsSection[];
}

/**
 * Wiki-style collapsible Contents box, numbered because the sections genuinely
 * are ordered below it (children nest as 3.1, 3.2 …). Callers should hide it
 * when only one section renders — a single-section article needs no contents.
 *
 * Links scroll manually: a plain hash anchor triggers a router navigation and
 * Remix's scroll restoration stomps the browser's anchor jump with the saved
 * position (the page twitches but lands back where it was until a second
 * click). scrollIntoView respects each section's scroll-mt-*.
 */
export function ContentsBox({ sections }: IContentsBoxProps) {
  const [open, setOpen] = useState(true);

  const jumpToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView();
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav className="mt-6 inline-block border border-gray-800 bg-gray-900">
      <Flex
        align="baseline"
        justify="between"
        gap="5"
        className={`px-5 py-1.5 ${open ? 'border-b border-gray-800' : ''}`}
      >
        <Text size="2" weight="medium" className="text-gray-300">
          Contents
        </Text>
        <button
          onClick={() => setOpen(isOpen => !isOpen)}
          className="text-sm text-gray-500 hover:text-white"
        >
          [{open ? 'hide' : 'show'}]
        </button>
      </Flex>
      {open && (
        <ol className="space-y-1 px-5 py-3">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={event => {
                  event.preventDefault();
                  jumpToSection(section.id);
                }}
                className={`text-base ${proseLinkClass}`}
              >
                <span className="mr-2 text-gray-600">{index + 1}.</span>
                {section.title}
                {section.count !== undefined && (
                  <span className="text-gray-600"> ({section.count})</span>
                )}
              </a>
              {section.children && (
                <ol className="mt-1 space-y-1 pl-5">
                  {section.children.map((child, childIndex) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        onClick={event => {
                          event.preventDefault();
                          jumpToSection(child.id);
                        }}
                        className={`text-base ${proseLinkClass}`}
                      >
                        <span className="mr-2 text-gray-600">
                          {index + 1}.{childIndex + 1}
                        </span>
                        {child.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
