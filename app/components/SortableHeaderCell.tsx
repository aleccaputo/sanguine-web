import { Table } from '@radix-ui/themes';

export type SortDirection = 'asc' | 'desc';
export type SortConfig<K extends string> = {
  key: K;
  direction: SortDirection;
};

interface ISortableHeaderCellProps<K extends string> {
  label: string;
  columnKey: K;
  activeSort: SortConfig<K> | null;
  onToggle: () => void;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Sortable Radix table header in the roster's chrome: orange label golding on
 * hover/active, ▲▼ before the label on right-aligned columns so the label
 * stays flush with the numbers beneath it. (SortableHeaderButton is the same
 * treatment for grid-based tables.)
 */
export function SortableHeaderCell<K extends string>({
  label,
  columnKey,
  activeSort,
  onToggle,
  align = 'left',
  className = '',
}: ISortableHeaderCellProps<K>) {
  const active = activeSort?.key === columnKey;
  const arrow = active && (
    <span
      className={`text-[9px] text-sanguine-bright ${
        align === 'right' ? 'mr-1' : 'ml-1'
      }`}
    >
      {activeSort.direction === 'asc' ? '▲' : '▼'}
    </span>
  );
  return (
    <Table.ColumnHeaderCell
      align={align}
      onClick={onToggle}
      className={`cursor-pointer select-none hover:text-osrs-gold ${
        active ? 'text-osrs-gold' : 'text-osrs-orange'
      } ${className}`}
    >
      {align === 'right' && arrow}
      {label}
      {align === 'left' && arrow}
    </Table.ColumnHeaderCell>
  );
}
