import { useMemo, useState } from 'react';
import { Text } from '@radix-ui/themes';
import { Input } from '~/components/input';

export interface IPickerMember {
  discordId: string;
  nickname: string;
}

interface IMemberPickerProps {
  /** The clan roster to search — discordId + display nickname. */
  members: IPickerMember[];
  /** Name of the hidden input carrying the selected ids as a JSON array. */
  inputName: string;
  defaultSelectedIds?: string[];
  id?: string;
  placeholder?: string;
}

const MAX_SUGGESTIONS = 8;
const RAW_DISCORD_ID = /^\d{5,25}$/;

/**
 * Typeahead multi-select over the clan roster: type a nickname, pick from the
 * dropdown, selections collect as removable chips. Pasting a raw Discord id is
 * the escape hatch for people missing from the roster. Submits ids via a hidden
 * input so plain Remix form posts work.
 */
export function MemberPicker({
  members,
  inputName,
  defaultSelectedIds = [],
  id,
  placeholder = 'Type a nickname…',
}: IMemberPickerProps) {
  const [selected, setSelected] = useState<string[]>(defaultSelectedIds);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const nicknameById = useMemo(
    () => new Map(members.map(m => [m.discordId, m.nickname])),
    [members],
  );

  const trimmed = query.trim();
  const suggestions = useMemo(() => {
    if (!trimmed) {
      return [];
    }
    const lower = trimmed.toLocaleLowerCase();
    const matches = members
      .filter(
        m =>
          !selected.includes(m.discordId) &&
          m.nickname.toLocaleLowerCase().includes(lower),
      )
      .slice(0, MAX_SUGGESTIONS);
    // Raw-id escape hatch for members not in the site roster
    if (
      !matches.length &&
      RAW_DISCORD_ID.test(trimmed) &&
      !selected.includes(trimmed)
    ) {
      return [{ discordId: trimmed, nickname: `Discord id ${trimmed}` }];
    }
    return matches;
  }, [members, selected, trimmed]);

  const pick = (discordId: string) => {
    setSelected(current =>
      current.includes(discordId) ? current : [...current, discordId],
    );
    setQuery('');
    setActiveIndex(0);
  };

  const remove = (discordId: string) =>
    setSelected(current => current.filter(id => id !== discordId));

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
      pick(
        suggestions[Math.min(activeIndex, suggestions.length - 1)].discordId,
      );
    } else if (e.key === 'Escape' && trimmed) {
      e.preventDefault();
      setQuery('');
    } else if (e.key === 'Backspace' && !query && selected.length) {
      remove(selected[selected.length - 1]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name={inputName} value={JSON.stringify(selected)} />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(discordId => {
            const nickname = nicknameById.get(discordId);
            return (
              <span
                key={discordId}
                className="flex items-center gap-1.5 rounded-sm border border-gray-700 bg-gray-900 py-0.5 pl-2 pr-1"
              >
                <Text
                  size="3"
                  className={
                    nickname ? 'text-sanguine-bright' : 'text-gray-400'
                  }
                >
                  {nickname ?? discordId}
                </Text>
                <button
                  type="button"
                  onClick={() => remove(discordId)}
                  aria-label={`Remove ${nickname ?? discordId}`}
                  className="cursor-pointer px-1 text-gray-500 hover:text-white"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
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
          placeholder={placeholder}
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
                key={suggestion.discordId}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  // mousedown fires before the input's blur, so the pick lands
                  onMouseDown={e => {
                    e.preventDefault();
                    pick(suggestion.discordId);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full cursor-pointer px-2 py-1.5 text-left text-base ${
                    index === activeIndex
                      ? 'bg-sanguine-red/10 text-white'
                      : 'text-sanguine-bright'
                  }`}
                >
                  {suggestion.nickname}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
