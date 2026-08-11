import * as React from 'react';

import { cn } from '~/utils/misc';

// Flat, square, visibly-bordered buttons per the design system — Radix's soft
// variant is a ~10%-alpha fill that disappears on the near-black page and
// reads as a bare text link. Red fill marks the committed action; danger and
// gold stay outlined so destructive chrome never outweighs the primary.
const VARIANT_CLASSES = {
  default:
    'border-gray-600 bg-gray-800 text-gray-100 enabled:hover:border-gray-400 enabled:hover:bg-gray-700',
  primary:
    'border-sanguine-red bg-sanguine-red text-white enabled:hover:border-sanguine-bright enabled:hover:bg-sanguine-bright',
  danger:
    'border-sanguine-red/50 bg-gray-900 text-sanguine-bright enabled:hover:border-sanguine-red enabled:hover:bg-sanguine-red/10',
  gold: 'border-osrs-gold/50 bg-gray-900 text-osrs-gold enabled:hover:border-osrs-gold enabled:hover:bg-osrs-gold/10',
} as const;

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-base',
  md: 'px-4 py-2 text-lg',
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'sm', ...props }, ref) => (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-sm border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button };
