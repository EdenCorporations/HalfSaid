'use client';

/**
 * The ambient backdrop shared by every screen: three large blurred purple orbs
 * drifting slowly behind a soft gradient. Purely decorative (aria-hidden) and
 * fixed behind content. All motion stops under prefers-reduced-motion.
 */
export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base gradient wash. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,#1E1B4B_0%,#121826_38%,#09090B_75%)]" />

      {/* Drifting orbs. */}
      <div
        className="absolute -left-32 top-[-10%] h-[46rem] w-[46rem] rounded-full bg-[#7C3AED] opacity-[0.22] blur-[120px]"
        style={{ animation: 'orb-drift 26s ease-in-out infinite' }}
      />
      <div
        className="absolute -right-40 top-[20%] h-[40rem] w-[40rem] rounded-full bg-[#A855F7] opacity-[0.16] blur-[130px]"
        style={{ animation: 'orb-drift 32s ease-in-out infinite reverse' }}
      />
      <div
        className="absolute bottom-[-20%] left-1/3 h-[38rem] w-[38rem] rounded-full bg-[#9333EA] opacity-[0.14] blur-[140px]"
        style={{ animation: 'orb-drift 38s ease-in-out infinite' }}
      />
    </div>
  );
}
