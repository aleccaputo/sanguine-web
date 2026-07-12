interface ISortableHeaderButtonProps {
  label: string;
  align: 'left' | 'right';
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}

/**
 * Column-header sort button: orange chrome that golds on hover and on the
 * active column, with the arrow on the active column only. Right-aligned
 * columns put the arrow before the label so the label's right edge stays
 * flush with the numbers beneath it.
 */
export function SortableHeaderButton({
  label,
  align,
  active,
  direction,
  onClick,
  className = '',
}: ISortableHeaderButtonProps) {
  const arrow = active && (
    <span className="text-[9px] text-sanguine-bright">
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  );
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-left text-sm hover:text-osrs-gold ${
        active ? 'text-osrs-gold' : ''
      } ${className}`}
    >
      {align === 'right' && arrow}
      {label}
      {align === 'left' && arrow}
    </button>
  );
}
