'use client';

import { cn } from '@/lib/utils';

/**
 * Slow-moving dotted waves along the bottom of the hero — a grid of dots that
 * drifts horizontally and fades upward, giving the field an energy-current feel.
 * Pure CSS, decorative, and reduced-motion-safe.
 */
export function DottedWave({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-1/2 overflow-hidden', className)}
      style={{
        maskImage: 'linear-gradient(to top, black 0%, transparent 85%)',
        WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 85%)',
      }}
    >
      <div
        className="absolute inset-y-0 -left-1/2 w-[200%] animate-wave-x"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(192,132,252,0.35) 1px, transparent 1.6px)',
          backgroundSize: '30px 30px',
        }}
      />
      <div
        className="absolute inset-y-0 -left-1/2 w-[200%] animate-wave-x"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(79,124,255,0.25) 1px, transparent 1.6px)',
          backgroundSize: '30px 30px',
          backgroundPosition: '15px 15px',
          animationDuration: '34s',
          animationDirection: 'reverse',
        }}
      />
    </div>
  );
}
