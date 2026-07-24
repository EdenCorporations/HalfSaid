'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

import { cn } from '@/lib/utils';

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  /** Stagger index — later cards fade in slightly later. */
  index?: number;
  /** Stronger blur/fill for hero surfaces. */
  strong?: boolean;
}

/**
 * A frosted-glass surface with a fade + slide-up entrance. Used for feature
 * cards, suggestion cards, and dashboard panels so the whole app shares one
 * material. Motion is spring-based and honoured only when motion is allowed.
 */
export function GlassCard({
  index = 0,
  strong = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay: index * 0.08 }}
      className={cn(strong ? 'glass-strong' : 'glass', 'rounded-2xl shadow-glow-soft', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
