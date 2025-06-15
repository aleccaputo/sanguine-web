import { MetaFunction } from '@remix-run/node';
import { Text, Card, Callout } from '@radix-ui/themes';
import { Link } from '@remix-run/react';
import { useState } from 'react';
import { tileRules } from '~/utils/bingo-rules';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Bingo' },
    { name: 'description', content: 'Used to view and manage bingo' },
  ];
};

const CollapsibleSection = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="mb-4">
      <div
        className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Text className="text-lg font-bold text-sanguine-red">{title}</Text>
        <span className="text-xl">{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-4 dark:border-gray-700">
          {children}
        </div>
      )}
    </Card>
  );
};

interface RuleItem {
  text: string;
  type: 'allowed' | 'prohibited' | 'requirement' | 'note' | 'example';
}

const RuleCard = ({ title, rules }: { title: string; rules: RuleItem[] }) => {
  const getColorClass = (type: RuleItem['type']) => {
    switch (type) {
      case 'allowed':
        return 'text-green-600';
      case 'prohibited':
        return 'text-red-600';
      case 'requirement':
        return 'text-amber-600';
      case 'note':
        return 'text-cyan-400';
      case 'example':
        return 'text-cyan-400';
      default:
        return '';
    }
  };

  const getPrefix = (type: RuleItem['type']) => {
    switch (type) {
      case 'allowed':
        return '✓ ';
      case 'prohibited':
        return '✗ ';
      case 'requirement':
        return 'Requirement: ';
      case 'note':
        return 'Note: ';
      case 'example':
        return 'Example: ';
      default:
        return '';
    }
  };

  return (
    <Card className="p-4">
      <Text className="text-2xl font-bold text-white">{title}</Text>
      <div className="mt-2 text-xl">
        {rules.map((rule, index) => (
          <p key={index} className={getColorClass(rule.type)}>
            {getPrefix(rule.type)}
            {rule.text}
          </p>
        ))}
      </div>
    </Card>
  );
};

const ColorCodedBox = ({
  title,
  items,
  bgColor,
  borderColor,
}: {
  title: string;
  items: string[];
  bgColor: string;
  borderColor: string;
}) => (
  <div className={`${bgColor} rounded border-l-4 p-3 ${borderColor}`}>
    <Text className="text-2xl font-semibold">{title}</Text>
    <ul className="mt-2 space-y-1 text-xl">
      {items.map((item, index) => (
        <li key={index}>• {item}</li>
      ))}
    </ul>
  </div>
);

const BingoRoute = () => {
  return (
    <div>
      <div className={'flex items-center justify-center'}>
        <Link to={'#rules'} className={'mt-2 hover:underline md:text-5xl'}>
          {'Click here for the rules and FAQs'}
        </Link>
      </div>
      <div className={'mt-2 flex h-screen flex-row items-start justify-center'}>
        <iframe
          className={'h-full w-full md:h-5/6 md:w-11/12'}
          src={'https://pattyrich.github.io/github-pages/#/bingo/join'}
          title={'Bingo'}
        ></iframe>
      </div>

      <div className={'m-3 md:m-10'}>
        <h1 id={'rules'} className="mb-6 text-3xl font-bold">
          Bingo Rules & FAQs
        </h1>

        <Callout.Root className="mb-6" color="red">
          <Callout.Text>
            <strong>Quick Start:</strong> Must use Wise Old Man plugin with
            codeword + timestamp. No boosting, stacking, or multi-accounting.
            Single drops can count for multiple tiles.
          </Callout.Text>
        </Callout.Root>

        <CollapsibleSection title="📋 General Rules" defaultOpen={true}>
          <div className="space-y-3">
            <ColorCodedBox
              title="Multi-Account Rules:"
              items={[
                'Must disclose multiple accounts before competition starts',
                'Only one account active at a time (no simultaneous play)',
                'Alts allowed as wilderness scouts only',
              ]}
              bgColor="bg-yellow-50 dark:bg-yellow-900/20"
              borderColor="border-yellow-400"
            />

            <ColorCodedBox
              title="Strictly Prohibited:"
              items={[
                'No boosting whatsoever',
                'No stacking clue caskets',
                'No stacking Wintertodt/Tempoross crates',
              ]}
              bgColor="bg-red-50 dark:bg-red-900/20"
              borderColor="border-red-400"
            />

            <ColorCodedBox
              title="Allowed Preparation:"
              items={[
                'Bank clues (complete during bingo)',
                'Store specific slayer tasks',
                'Single drops count for multiple tiles',
              ]}
              bgColor="bg-green-50 dark:bg-green-900/20"
              borderColor="border-green-400"
            />

            <ColorCodedBox
              title="Required Plugin Setup:"
              items={[
                'Wise Old Man plugin mandatory',
                'Include codeword + timestamp in all screenshots',
                'Screenshots required for drop verification',
              ]}
              bgColor="bg-blue-50 dark:bg-blue-900/20"
              borderColor="border-blue-400"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="🎯 Specific Tile Rules">
          <div className="grid gap-4 md:grid-cols-2">
            {tileRules.map((tile, index) => (
              <RuleCard key={index} title={tile.title} rules={tile.rules} />
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default BingoRoute;
