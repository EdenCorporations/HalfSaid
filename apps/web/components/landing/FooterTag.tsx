'use client';

import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

/**
 * A small trust line — HalfSaid never invents words. Reinforces the product's
 * core safety promise without a paragraph.
 */
export function FooterTag() {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.1, duration: 0.6 }}
      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
    >
      <ShieldCheck className="h-3.5 w-3.5 text-[#C084FC]" aria-hidden="true" />
      Grounded in your own words — never invented.
    </motion.p>
  );
}
