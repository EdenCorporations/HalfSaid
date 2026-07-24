'use client';

import { motion } from 'framer-motion';
import { Mic, Sparkles, Heart, type LucideIcon } from 'lucide-react';

const CARDS: { icon: LucideIcon; title: string; body: string; glow: string }[] = [
  {
    icon: Mic,
    title: 'Voice Recognition',
    body: 'Speak naturally — even half a sentence is enough.',
    glow: '#C084FC',
  },
  {
    icon: Sparkles,
    title: 'Smart Suggestions',
    body: 'Whole phrases drawn only from your own words.',
    glow: '#FF3EA5',
  },
  {
    icon: Heart,
    title: 'Built for Aphasia',
    body: 'Large, calm, and simple — designed to lower anxiety.',
    glow: '#4F7CFF',
  },
];

/**
 * The bottom row of three glass feature cards — staggered up on load, lifting
 * and glowing on hover, each icon inside a glowing coloured circle.
 */
export function FeatureCards() {
  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
      {CARDS.map((c, i) => (
        <motion.div
          key={c.title}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 + i * 0.12, type: 'spring', stiffness: 130, damping: 18 }}
          whileHover={{ y: -6 }}
          className="glass group flex items-center gap-3 rounded-2xl border border-white/[0.08] p-4 shadow-glow-soft transition-shadow hover:shadow-glow sm:flex-col sm:items-start sm:gap-2 sm:p-5"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 transition-transform group-hover:scale-110"
            style={{ color: c.glow, boxShadow: `0 0 20px -4px ${c.glow}` }}
          >
            <c.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold text-white">{c.title}</h2>
            <p className="text-sm leading-snug text-muted-foreground">{c.body}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
