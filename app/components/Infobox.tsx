import { Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

interface IInfoboxProps {
  children: ReactNode;
}

/**
 * Wiki-style infobox: a bordered aside that sticks below the 73px navbar on
 * large screens. Compose bands (InfoboxBand) and dl rows (InfoboxRow) inside.
 */
export function Infobox({ children }: IInfoboxProps) {
  return (
    <aside className="mt-6 w-full shrink-0 self-start border border-gray-700 lg:sticky lg:top-[89px] lg:w-80">
      {children}
    </aside>
  );
}

interface IInfoboxBandProps {
  children: ReactNode;
  primary?: boolean;
}

/**
 * Solid red band. The primary band titles the infobox; secondary bands group
 * the stat rows beneath them ("Clan record").
 */
export function InfoboxBand({ children, primary = false }: IInfoboxBandProps) {
  return primary ? (
    <Text
      as="div"
      size="3"
      weight="medium"
      className="bg-sanguine-red px-3 py-1.5 text-center text-white"
    >
      {children}
    </Text>
  ) : (
    <Text
      as="div"
      size="2"
      weight="medium"
      className="border-t border-gray-800 bg-sanguine-red px-3 py-1 text-center text-white"
    >
      {children}
    </Text>
  );
}

interface IInfoboxRowProps {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}

/**
 * One label/value vitals row. Color the value per the grammar: white for drop
 * points, osrs-gold for clan points and gp, gray-200 for plain facts.
 * Conditional rows should drop out at the call site rather than render empty.
 */
export function InfoboxRow({
  label,
  children,
  valueClassName = 'text-gray-200',
}: IInfoboxRowProps) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
      <dt className="text-base text-gray-500">{label}</dt>
      <dd className={`text-base ${valueClassName}`}>{children}</dd>
    </div>
  );
}
