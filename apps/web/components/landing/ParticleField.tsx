'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';

/**
 * A field of tiny glowing, twinkling particles. Positions are deterministic
 * (index-based math, no Math.random) so SSR and client match — no hydration
 * mismatch. Decorative and reduced-motion-safe.
 */
const COUNT = 44;
const PARTICLES = Array.from({ length: COUNT }, (_, i) => {
  const left = ((i * 67.3) % 100).toFixed(3);
  const top = ((i * 39.7 + (i % 5) * 7) % 100).toFixed(3);
  const size = 1 + (i % 3);
  const delay = (i % 7) * 0.6;
  const dur = 3.5 + (i % 5);
  const hue = i % 3; // 0 purple, 1 pink, 2 blue
  return { left, top, size, delay, dur, hue };
});

const COLORS = ['#C084FC', '#FF3EA5', '#4F7CFF'];

export function ParticleField({
  mx,
  my,
  depth = 16,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth?: number;
}) {
  const x = useTransform(mx, [-1, 1], [-depth, depth]);
  const y = useTransform(my, [-1, 1], [-depth, depth]);

  return (
    <motion.div aria-hidden="true" style={{ x, y }} className="pointer-events-none absolute inset-0">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            backgroundColor: COLORS[p.hue],
            boxShadow: `0 0 ${p.size * 4}px ${COLORS[p.hue]}`,
            animation: `twinkle ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </motion.div>
  );
}
