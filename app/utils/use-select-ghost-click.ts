import { useRef } from 'react';

/**
 * On touch devices Radix Select leaks a ghost click to whatever sits behind
 * the closing dropdown (radix-ui/primitives#1658): the tap's click fires after
 * the content unmounts and lands on e.g. a clickable table row. Wire
 * `onSelectOpenChange` to every Select.Root that floats over clickable rows,
 * and have row click handlers bail when `isGhostClick()`.
 */
export function useSelectGhostClickGuard() {
  const closedAt = useRef(0);
  const onSelectOpenChange = (open: boolean) => {
    if (!open) closedAt.current = Date.now();
  };
  const isGhostClick = () => Date.now() - closedAt.current < 400;
  return { onSelectOpenChange, isGhostClick };
}
