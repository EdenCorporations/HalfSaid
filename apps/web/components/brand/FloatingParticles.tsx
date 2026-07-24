'use client';

/**
 * Slow-floating dust particles for depth. Positions are a fixed, deterministic
 * set (no Math.random) so server and client render identically — no hydration
 * mismatch. Decorative and reduced-motion-safe.
 */
const PARTICLES = [
  { left: '8%', top: '18%', size: 3, delay: 0, dur: 7 },
  { left: '22%', top: '72%', size: 2, delay: 1.4, dur: 9 },
  { left: '35%', top: '30%', size: 4, delay: 0.8, dur: 8 },
  { left: '48%', top: '84%', size: 2, delay: 2.1, dur: 10 },
  { left: '61%', top: '22%', size: 3, delay: 1.1, dur: 7.5 },
  { left: '73%', top: '60%', size: 2, delay: 0.4, dur: 9.5 },
  { left: '84%', top: '38%', size: 4, delay: 1.8, dur: 8.5 },
  { left: '92%', top: '78%', size: 2, delay: 2.6, dur: 11 },
  { left: '15%', top: '50%', size: 2, delay: 3, dur: 8 },
  { left: '55%', top: '52%', size: 3, delay: 0.6, dur: 9 },
];

export function FloatingParticles() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/40 shadow-glow"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animation: `float-slow ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
