/**
 * Inline OSRS coins sprite for gp values — sits beside an osrs-gold amount
 * ("<CoinsIcon /> 1,234,567 gp").
 */
export function CoinsIcon() {
  return (
    <img
      src="https://oldschool.runescape.wiki/images/Coins_detail.png"
      alt=""
      className="inline h-3.5 w-3.5 object-contain align-[-2px]"
    />
  );
}
