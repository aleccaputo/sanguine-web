import { Flex } from '@radix-ui/themes';

export interface IChipOption {
  key: string;
  label: string;
  iconSrc?: string;
  iconAlt?: string;
  count?: number;
}

interface IChipGroupProps {
  options: IChipOption[];
  value: string;
  onChange: (key: string) => void;
}

/**
 * Square filter chips (rounded-sm — game UI has hard edges): the active chip
 * fills solid red, the rest stay dark with a border that lightens on hover.
 * Optional 16px pixel-art icon and a muted count after the label.
 */
export function ChipGroup({ options, value, onChange }: IChipGroupProps) {
  return (
    <Flex align="center" gap="2" wrap="wrap">
      {options.map(option => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm ${
              active
                ? 'border-sanguine-red bg-sanguine-red text-white'
                : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600 hover:text-white'
            }`}
          >
            {option.iconSrc && (
              <img
                src={option.iconSrc}
                alt={option.iconAlt ?? ''}
                width={16}
                height={16}
                className="shrink-0 [image-rendering:pixelated]"
              />
            )}
            {option.label}
            {option.count !== undefined && (
              <span className={active ? 'text-white/70' : 'text-gray-600'}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </Flex>
  );
}
