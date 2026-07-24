'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';

/**
 * Minimal top navigation: a centred HALFSAID wordmark with a glowing purple dot,
 * and a glass profile circle (top-right) linking to the clinician view.
 */
export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10"
    >
      {/* Left spacer keeps the wordmark optically centred. */}
      <div className="h-9 w-9" aria-hidden="true" />

      <Link
        href="/"
        aria-label="HalfSaid home"
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3"
      >
        <span className="h-2 w-2 animate-breathe rounded-full bg-[#C084FC] shadow-[0_0_12px_#C084FC]" />
        <span className="font-heading text-sm font-semibold text-white/85 [letter-spacing:12px]">
          HALFSAID
        </span>
      </Link>

      <Link
        href="/clinician"
        aria-label="Clinician dashboard"
        className="glass flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-all hover:text-white hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </Link>
    </motion.nav>
  );
}
