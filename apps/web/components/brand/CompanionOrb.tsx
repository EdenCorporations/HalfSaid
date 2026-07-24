'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'celebrating';

export interface CompanionOrbProps {
  /** Emotional state — drives glow, rings, eyes, and mouth. */
  state?: OrbState;
  /** Diameter in px. */
  size?: number;
  /** Render a warm smile (e.g. on hover). */
  smiling?: boolean;
  className?: string;
}

/**
 * The emotional centre of HalfSaid — a self-contained, breathing "companion".
 * No 3D dependency and no network: a layered gradient sphere with eyes that
 * blink, a mouth that moves while speaking, expanding rings while listening, and
 * a head that gently follows the cursor. Purely decorative for assistive tech
 * (state is announced separately via aria-live), so it is aria-hidden. All
 * motion is disabled under prefers-reduced-motion.
 */
export function CompanionOrb({
  state = 'idle',
  size = 460,
  smiling = false,
  className,
}: CompanionOrbProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Head/eyes gently follow the cursor.
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const x = useSpring(rx, { stiffness: 90, damping: 16 });
  const y = useSpring(ry, { stiffness: 90, damping: 16 });

  useEffect(() => {
    if (reduce) return;
    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const max = 14;
      rx.set(Math.max(-max, Math.min(max, (e.clientX - cx) / 22)));
      ry.set(Math.max(-max, Math.min(max, (e.clientY - cy) / 22)));
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [reduce, rx, ry]);

  const active = state === 'listening' || state === 'speaking';
  const bright = active || state === 'celebrating';

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('relative select-none', className)}
      style={{ width: size, height: size }}
    >
      {/* Outer halo. */}
      <div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(168,85,247,0.55), rgba(124,58,237,0.15) 60%, transparent 72%)',
          animation: reduce ? undefined : 'breathe 5s ease-in-out infinite',
        }}
      />

      {/* Listening / speaking pulse rings. */}
      {active && !reduce && (
        <>
          <span className="absolute inset-[12%] rounded-full border border-[#A855F7]/40 animate-pulse-ring" />
          <span
            className="absolute inset-[12%] rounded-full border border-[#A855F7]/30 animate-pulse-ring"
            style={{ animationDelay: '0.8s' }}
          />
          <span
            className="absolute inset-[12%] rounded-full border border-[#A855F7]/20 animate-pulse-ring"
            style={{ animationDelay: '1.6s' }}
          />
        </>
      )}

      {/* Floating + breathing wrapper. */}
      <motion.div
        className="absolute inset-[14%]"
        animate={
          reduce
            ? undefined
            : state === 'celebrating'
              ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }
              : { scale: [1, 1.045, 1] }
        }
        transition={{
          duration: state === 'celebrating' ? 0.7 : 5,
          repeat: state === 'celebrating' ? 0 : Infinity,
          ease: 'easeInOut',
        }}
        style={{ animation: reduce ? undefined : 'float-slow 7s ease-in-out infinite' }}
      >
        {/* Core sphere. */}
        <div
          className="relative h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(circle at 38% 32%, #C4B5FD 0%, #A855F7 26%, #7C3AED 55%, #5B21B6 82%, #3B0764 100%)',
            boxShadow: bright
              ? '0 0 90px 8px rgba(168,85,247,0.55), inset 0 -30px 60px rgba(59,7,100,0.6)'
              : '0 0 60px 0 rgba(124,58,237,0.4), inset 0 -30px 60px rgba(59,7,100,0.6)',
            transition: 'box-shadow 500ms ease',
          }}
        >
          {/* Specular highlight. */}
          <div className="absolute left-[20%] top-[16%] h-[26%] w-[26%] rounded-full bg-white/60 blur-xl" />

          {/* Face — follows the cursor. */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ x, y }}
          >
            <div className="flex items-center gap-[10%]" style={{ width: '46%' }}>
              <Eye reduce={!!reduce} thinking={state === 'thinking'} />
              <Eye reduce={!!reduce} thinking={state === 'thinking'} />
            </div>
            {/* Mouth. */}
            {smiling && state !== 'speaking' ? (
              <div
                className="mt-[8%] rounded-b-full border-b-[3px] border-white/85"
                style={{ width: '28%', height: '13%', transition: 'all 300ms ease' }}
              />
            ) : (
              <div
                className="mt-[8%] rounded-full bg-white/85"
                style={{
                  width: state === 'speaking' ? '18%' : '22%',
                  height: state === 'speaking' ? '10%' : '4%',
                  transformOrigin: 'center',
                  animation:
                    state === 'speaking' && !reduce
                      ? 'mouth-talk 0.4s ease-in-out infinite'
                      : undefined,
                  transition: 'height 300ms ease, width 300ms ease',
                }}
              />
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function Eye({ reduce, thinking }: { reduce: boolean; thinking: boolean }) {
  return (
    <div className="relative flex-1" style={{ aspectRatio: '1 / 1.4' }}>
      <div
        className="h-full w-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]"
        style={{
          transformOrigin: 'center',
          animation: reduce ? undefined : 'blink 5.5s ease-in-out infinite',
          transform: thinking ? 'translateY(-12%)' : undefined,
          transition: 'transform 400ms ease',
        }}
      />
    </div>
  );
}
