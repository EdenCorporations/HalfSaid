'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

const BARS = [0.35, 0.6, 0.85, 1, 0.75, 0.5, 0.9, 0.65, 0.4, 0.7, 0.55, 0.8];

/**
 * A live voice waveform shown while listening or speaking. Decorative only —
 * the listening/speaking status is announced in text elsewhere — so it is
 * aria-hidden. Bars settle flat and still under prefers-reduced-motion.
 */
export function VoiceWave({ active = false, className }: { active?: boolean; className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden="true" className={cn('flex h-10 items-center justify-center gap-1.5', className)}>
      {BARS.map((peak, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-[#7C3AED] to-[#A855F7]"
          initial={{ height: 6 }}
          animate={
            active && !reduce
              ? { height: [6, 6 + peak * 30, 6] }
              : { height: 6 }
          }
          transition={
            active && !reduce
              ? { duration: 0.9 + i * 0.05, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}
