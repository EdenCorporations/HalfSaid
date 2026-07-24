'use client';

import { motion } from 'framer-motion';

const STATS: { value: string; label: string }[] = [
  { value: '2M+', label: 'Americans live with aphasia' },
  { value: '180k', label: 'new cases every year' },
  { value: '1', label: 'graph per person — yours' },
];

/**
 * Compact problem/solution stats (Enhancement 12) — frames the "why" in the
 * first ten seconds without breaking the one-viewport hero.
 */
export function StatStrip() {
  return (
    <motion.dl
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.6, ease: 'easeOut' }}
      className="flex items-center gap-6"
    >
      {STATS.map((s) => (
        <div key={s.label} className="flex flex-col">
          <dt className="sr-only">{s.label}</dt>
          <dd className="font-heading text-lg font-semibold text-white">{s.value}</dd>
          <dd className="max-w-[9rem] text-[11px] leading-tight text-muted-foreground">
            {s.label}
          </dd>
        </div>
      ))}
    </motion.dl>
  );
}
