import { GOD_BY_COLOR } from '~/utils/tile-race-teams';

interface ITeamTokenProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

/**
 * Square game-pawn marker: the team's god symbol framed in its accent color.
 * The god derives from the color (they're paired in TEAM_IDENTITIES), with the
 * team initial as a fallback if the pairing ever misses.
 */
export function TeamToken({ name, color, size = 'md' }: ITeamTokenProps) {
  const god = GOD_BY_COLOR[color];
  const sizeClass =
    size === 'sm'
      ? 'h-5 w-5 text-[11px] sm:h-6 sm:w-6 sm:text-xs'
      : 'h-6 w-6 text-xs sm:h-8 sm:w-8 sm:text-sm';
  return (
    <span
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-sm border-2 bg-[#111113] p-0.5 font-bold text-gray-100 ${sizeClass}`}
      style={{ borderColor: color }}
    >
      {god ? (
        <img
          src={`/god-symbols/${god}.png`}
          alt=""
          className="h-full w-full object-contain [image-rendering:pixelated]"
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}
