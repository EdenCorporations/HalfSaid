'use client';

import { motion } from 'framer-motion';

const line = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 18, delay: 0.15 + i * 0.14 },
  }),
};

/**
 * The hero headline — "Helping Every / Voice / Be Heard." — revealed line by
 * line, with an animated pink gradient sweeping across "Voice".
 */
export function AnimatedHeadline() {
  return (
    <h1 className="font-heading text-[clamp(2.6rem,6vw,4.75rem)] font-bold leading-[1.02] tracking-tight text-white">
      <motion.span custom={0} variants={line} initial="hidden" animate="show" className="block">
        Helping Every
      </motion.span>
      <motion.span
        custom={1}
        variants={line}
        initial="hidden"
        animate="show"
        className="block animate-gradient-x bg-[linear-gradient(90deg,#FF3EA5,#C084FC,#FF1F7A,#FF3EA5)] bg-[length:200%_auto] bg-clip-text text-transparent"
      >
        Voice
      </motion.span>
      <motion.span custom={2} variants={line} initial="hidden" animate="show" className="block">
        Be Heard.
      </motion.span>
    </h1>
  );
}
