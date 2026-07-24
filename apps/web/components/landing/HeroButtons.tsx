'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mic, Play } from 'lucide-react';

/**
 * The two hero CTAs. Primary: an expensive pink-gradient pill that scales,
 * glows, and ripples on hover -> the live conversation. Secondary: a glass
 * button with a purple hover glow -> the clinician view of the system working.
 */
export function HeroButtons() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, type: 'spring', stiffness: 120, damping: 18 }}
      className="flex flex-col items-center gap-4 sm:flex-row"
    >
      <Link
        href="/canvas"
        aria-label="Start Conversation"
        className="group relative inline-flex h-16 items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[#FF4DA0] to-[#FF1F7A] px-8 text-lg font-semibold text-white shadow-[0_10px_40px_-6px_rgba(255,31,122,0.7)] transition-all duration-300 hover:scale-105 hover:shadow-[0_16px_60px_-6px_rgba(255,31,122,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-100"
      >
        {/* Ripple on hover. */}
        <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 ring-2 ring-white/50 transition group-hover:animate-pulse-ring group-hover:opacity-100" />
        <Mic className="h-5 w-5" aria-hidden="true" />
        Start Conversation
      </Link>

      <Link
        href="/clinician"
        aria-label="See How It Works"
        className="glass inline-flex h-16 items-center gap-2.5 rounded-full border border-white/10 px-7 text-lg font-medium text-white/90 transition-all duration-300 hover:border-[#C084FC]/60 hover:text-white hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Play className="h-5 w-5" aria-hidden="true" />
        See How It Works
      </Link>
    </motion.div>
  );
}
