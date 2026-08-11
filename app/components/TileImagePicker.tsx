import { useEffect, useRef, useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { Text } from '@radix-ui/themes';
import { Input } from '~/components/input';
import type { ITileImageOption } from '~/utils/tile-image-catalog';

interface ITileImagePickerProps {
  /** Currently selected wiki image URL, if any. */
  value?: string;
  onChange: (imageUrl: string | undefined) => void;
  id?: string;
}

const DEBOUNCE_MS = 250;

// "https://.../images/Great_Olm.png" -> "Great Olm"
const labelFromUrl = (url: string): string => {
  const file = url.split('/').pop() ?? url;
  return decodeURIComponent(file)
    .replace(/\.(png|gif|jpg)$/i, '')
    .replace(/_/g, ' ');
};

/**
 * Typeahead single-select over OSRS artwork (bosses/activities + any item),
 * backed by the staff-only /admin/image-search resource route. The selection
 * shows as a thumbnail chip with a clear button; the chosen URL reaches the
 * form via the parent's tile state, not a hidden input of its own.
 */
export function TileImagePicker({ value, onChange, id }: ITileImagePickerProps) {
  const fetcher = useFetcher<{ results: ITileImageOption[] }>();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < 2) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetcher.load(`/admin/image-search?q=${encodeURIComponent(trimmed)}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
    // fetcher identity changes across loads; keying the effect on it would re-fire endlessly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  const suggestions = trimmed.length < 2 ? [] : (fetcher.data?.results ?? []);

  const pick = (option: ITileImageOption) => {
    onChange(option.imageUrl);
    setQuery('');
    setActiveIndex(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions.length) {
      // Swallow the submit only while choosing a suggestion
      e.preventDefault();
      pick(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    } else if (e.key === 'Escape' && trimmed) {
      e.preventDefault();
      setQuery('');
    }
  };

  if (value) {
    return (
      <span className="flex w-fit items-center gap-2 rounded-sm border border-gray-700 bg-gray-900 py-1 pl-2 pr-1">
        <img
          src={value}
          alt=""
          className="h-6 w-6 object-contain"
          loading="lazy"
        />
        <Text size="3" className="text-gray-100">
          {labelFromUrl(value)}
        </Text>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Remove image"
          className="cursor-pointer px-1 text-gray-500 hover:text-white"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setQuery('')}
        placeholder="Search a boss or item…"
        className="text-base"
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-autocomplete="list"
      />
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto border border-gray-700 bg-[#111113]"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.imageUrl}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                // mousedown fires before the input's blur, so the pick lands
                onMouseDown={e => {
                  e.preventDefault();
                  pick(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-base ${
                  index === activeIndex
                    ? 'bg-sanguine-red/10 text-white'
                    : 'text-gray-200'
                }`}
              >
                <img
                  src={suggestion.imageUrl}
                  alt=""
                  className="h-6 w-6 object-contain"
                  loading="lazy"
                />
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
