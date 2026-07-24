'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion, useTransform } from 'framer-motion';

import { ParticleField } from './ParticleField';
import { FloatingBlob } from './FloatingBlob';
import { DottedWave } from './DottedWave';

/**
 * The living hero backdrop: animated gradient base, drifting energy blobs,
 * twinkling particle field, moving dotted waves, a soft radial glow behind the
 * robot, noise, and vignette — all reacting to the cursor with layered parallax.
 * Fully decorative (aria-hidden) and reduced-motion-safe.
 */
export function HeroBackground() {
  const reduce = useReducedMotion();

  // Normalised pointer position (-1..1), smoothed.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 20 });
  const my = useSpring(rawY, { stiffness: 60, damping: 20 });

  // The central glow drifts gently the opposite way for depth.
  const glowX = useTransform(mx, [-1, 1], [24, -24]);
  const glowY = useTransform(my, [-1, 1], [24, -24]);

  useEffect(() => {
    if (reduce) return;
    function onMove(e: MouseEvent) {
      rawX.set((e.clientX / window.innerWidth) * 2 - 1);
      rawY.set((e.clientY / window.innerHeight) * 2 - 1);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [reduce, rawX, rawY]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base wash. */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_130%_at_50%_-20%,#1E1B4B_0%,#121826_40%,#09090B_78%)]" />

      {/* Energy blobs (deepest parallax). */}
      <FloatingBlob
        color="#7C3AED"
        mx={mx}
        my={my}
        depth={46}
        className="-left-24 top-[-12%] h-[42rem] w-[42rem] opacity-[0.24]"
      />
      <FloatingBlob
        color="#FF3EA5"
        mx={mx}
        my={my}
        depth={38}
        duration={30}
        className="-right-28 top-[8%] h-[34rem] w-[34rem] opacity-[0.16]"
      />
      <FloatingBlob
        color="#4F7CFF"
        mx={mx}
        my={my}
        depth={34}
        duration={36}
        className="bottom-[-18%] left-1/4 h-[34rem] w-[34rem] opacity-[0.16]"
      />

      {/* Soft radial glow behind the robot. */}
      <motion.div
        style={{ x: glowX, y: glowY }}
        className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(192,132,252,0.28),transparent_66%)] blur-2xl"
      />

      {/* Moving dotted waves. */}
      <DottedWave />

      {/* Twinkling particle field (shallowest parallax). */}
      <ParticleField mx={mx} my={my} depth={18} />

      {/* Noise + vignette. */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,transparent_55%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
}
