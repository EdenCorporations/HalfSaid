'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * A large blurred energy blob that drifts slowly and shifts with the cursor for
 * parallax depth. Decorative; motion stops under prefers-reduced-motion.
 */
export function FloatingBlob({
  color,
  className,
  mx,
  my,
  depth = 40,
  duration = 26,
}: {
  color: string;
  className?: string;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth?: number;
  duration?: number;
}) {
  const x = useTransform(mx, [-1, 1], [-depth, depth]);
  const y = useTransform(my, [-1, 1], [-depth, depth]);

  return (
    <motion.div
      aria-hidden="true"
      style={{ x, y, backgroundColor: color, animationDuration: `${duration}s` }}
      className={cn(
        'pointer-events-none absolute rounded-full blur-[120px] animate-blob',
        className,
      )}
    />
  );
}
