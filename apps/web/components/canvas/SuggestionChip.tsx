'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * A small rounded chip that slides up into view — used for refusal alternatives
 * and other quick, glanceable options. Presentational by default; pass `as`
 * behaviour from the caller when it needs to be interactive.
 */
export function SuggestionChip({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 18, delay: index * 0.06 }}
      className={cn(
        'inline-flex min-h-touch items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur',
        className,
      )}
    >
      {children}
    </motion.span>
  );
}
