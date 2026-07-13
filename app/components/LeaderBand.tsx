import { Box, Text } from '@radix-ui/themes';

export interface ILeaderEntry {
  key: string;
  iconSrc: string;
  iconAlt: string;
  label: string;
  value: string;
  onClick: () => void;
}

export interface ILeaderBoard {
  key: string;
  title: string;
  valueClassName: string;
  entries: ILeaderEntry[];
}

interface ILeaderBandProps {
  boards: ILeaderBoard[];
}

/**
 * Flat, typographic top-list band under one committed red top rule — no boxes.
 * Each board is a column of ranked entries; the #1 entry reads a size larger
 * with a gold rank number. Color values per the grammar via valueClassName
 * (osrs-gold for clan points, white for drop points).
 */
export function LeaderBand({ boards }: ILeaderBandProps) {
  const gridColsClass =
    boards.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <Box
      mb="6"
      className="border-b border-t-2 border-gray-800 border-t-sanguine-red"
    >
      <div className={`grid grid-cols-1 ${gridColsClass}`}>
        {boards.map((board, boardIndex) => (
          <div
            key={board.key}
            className={
              boardIndex > 0
                ? 'border-t border-gray-800 pb-2 sm:border-l sm:border-t-0 sm:pl-5'
                : 'pb-2 sm:pr-5'
            }
          >
            <Text as="p" size="2" className="pt-2 text-gray-500">
              {board.title}
            </Text>
            {board.entries.map((entry, index) => (
              <button
                key={entry.key}
                onClick={entry.onClick}
                className="group flex w-full min-w-0 items-center gap-3 py-1.5 text-left"
              >
                <span
                  className={`w-5 shrink-0 text-right leading-none ${
                    index === 0
                      ? 'text-xl text-osrs-gold'
                      : 'text-base text-gray-600'
                  }`}
                >
                  {index + 1}
                </span>
                <img
                  src={entry.iconSrc}
                  alt={entry.iconAlt}
                  width={22}
                  height={22}
                  className="shrink-0 [image-rendering:pixelated]"
                />
                <Text
                  as="div"
                  className={`min-w-0 flex-1 truncate leading-tight text-sanguine-bright group-hover:text-white ${
                    index === 0 ? 'text-xl' : 'text-base'
                  }`}
                >
                  {entry.label}
                </Text>
                <Text
                  as="div"
                  className={`text-right ${board.valueClassName} ${
                    index === 0 ? 'text-xl' : 'text-base'
                  }`}
                >
                  {entry.value}
                </Text>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Box>
  );
}
