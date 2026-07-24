'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { CompanionOrb } from '@/components/brand/CompanionOrb';

/**
 * The emotional centre of the hero. A Spline 3D model can drop in here later;
 * until then the self-contained CompanionOrb is the placeholder — breathing,
 * blinking, cursor-following, and smiling on hover — with a floating speech
 * bubble. No network dependency, so the demo can never fail to load.
 */
export function RobotSpline({ size = 340 }: { size?: number }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Floating speech bubble. */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
        transition={{
          opacity: { delay: 0.6, duration: 0.5 },
          scale: { delay: 0.6, type: 'spring', stiffness: 160, damping: 16 },
          y: { delay: 0.6, duration: 4, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="glass absolute -top-2 right-[6%] z-10 rounded-2xl rounded-br-sm px-4 py-2 text-sm font-medium text-white shadow-glow-soft"
      >
        I&rsquo;m listening.
      </motion.div>

      <CompanionOrb state={hover ? 'listening' : 'idle'} smiling={hover} size={size} />
    </div>
  );
}
