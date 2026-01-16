import { useNavigation } from '@remix-run/react';
import { useEffect, useRef, useState } from 'react';
import { useSpinDelay } from 'spin-delay';
import { cn } from '~/utils/misc';
// import { Icon } from './ui/icon.tsx'

function LoadingBar() {
  const transition = useNavigation();
  const busy = transition.state === 'loading';
  const delayedPending = useSpinDelay(busy, {
    delay: 200,
    minDuration: 400,
  });
  const ref = useRef<HTMLDivElement>(null);
  const [animationComplete, setAnimationComplete] = useState(true);

  useEffect(() => {
    if (!ref.current) return;
    if (delayedPending) setAnimationComplete(false);

    const animationPromises = ref.current
      .getAnimations()
      .map(({ finished }) => finished);

    Promise.allSettled(animationPromises).then(() => {
      if (!delayedPending) setAnimationComplete(true);
    });
  }, [delayedPending]);

  return (
    <>
      {/* Enhanced Loading Bar - Shows immediately */}
      <div
        role="progressbar"
        aria-hidden={busy ? undefined : true}
        aria-valuetext={busy ? 'Loading' : undefined}
        className="fixed inset-x-0 left-0 top-0 z-50 h-1"
      >
        <div
          ref={ref}
          className={cn(
            'h-full w-0 bg-sanguine-red shadow-[0_0_10px_rgba(187,44,35,0.8)] duration-500 ease-in-out',
            transition.state === 'idle' &&
              (animationComplete
                ? 'transition-none'
                : 'w-full opacity-0 transition-all'),
            busy && transition.state === 'submitting' && 'w-5/12',
            busy && transition.state === 'loading' && 'w-8/12',
          )}
        />
      </div>

      {/* Viewport Spinner - Shows after delay */}
      {delayedPending && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-sanguine-red"></div>
            <div className="rounded-lg bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
              Loading...
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { LoadingBar };
