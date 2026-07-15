import { Link } from '@remix-run/react';
import { Box, Text } from '@radix-ui/themes';
import dayjs from 'dayjs';

export interface IClogUnlockTile {
  key: string;
  name: string;
  icon: string;
  date: string;
  player: { name: string; discordId?: string };
}

interface IClogUnlockStripProps {
  title: string;
  unlocks: IClogUnlockTile[];
}

/**
 * Horizontally scrolling marquee of recent collection log unlocks — item icon
 * over name, finder, and date, in the spirit of collectionlog.net's group
 * feed. No boxes: flat tiles with the blood-tint hover, scrolling inside
 * their own container so the page never scrolls sideways.
 */
export function ClogUnlockStrip({ title, unlocks }: IClogUnlockStripProps) {
  return (
    <Box mb="6">
      <Text as="p" size="2" className="text-gray-500">
        {title}
      </Text>
      <div className="mt-1 flex snap-x gap-1 overflow-x-auto border-b border-gray-800 pb-2 [scrollbar-width:thin]">
        {unlocks.map(unlock => {
          const tile = (
            <>
              <Box className="mx-auto flex h-10 w-10 items-center justify-center">
                <img
                  src={unlock.icon}
                  alt=""
                  className="max-h-10 max-w-10 object-contain"
                />
              </Box>
              <Text
                as="div"
                size="1"
                className="mt-1 truncate font-medium text-white"
              >
                {unlock.name}
              </Text>
              <Text
                as="div"
                size="1"
                className={`truncate ${
                  unlock.player.discordId
                    ? 'text-sanguine-bright group-hover:text-white'
                    : 'text-gray-400'
                }`}
              >
                {unlock.player.name}
              </Text>
              <Text as="div" size="1" className="text-gray-600">
                {dayjs(unlock.date).format('MMM D')}
              </Text>
            </>
          );
          const tileClass =
            'group w-28 shrink-0 snap-start rounded-sm px-2 py-2 text-center';
          const tileTitle = `${unlock.name} · ${unlock.player.name} · ${dayjs(
            unlock.date,
          ).format('MMM D, YYYY')}`;
          return unlock.player.discordId ? (
            <Link
              key={unlock.key}
              to={`/users/${unlock.player.discordId}`}
              title={tileTitle}
              className={`${tileClass} hover:bg-sanguine-red/[0.09]`}
            >
              {tile}
            </Link>
          ) : (
            <div key={unlock.key} title={tileTitle} className={tileClass}>
              {tile}
            </div>
          );
        })}
      </div>
    </Box>
  );
}
