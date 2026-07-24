import type { ReactNode } from 'react';

import { AnimatedBackground } from './AnimatedBackground';
import { FloatingParticles } from './FloatingParticles';

/**
 * Wraps a screen with the shared ambient backdrop (drifting orbs + particles)
 * and keeps page content above it. Every route renders inside this so the
 * companion aesthetic is consistent from landing to canvas to dashboard.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <FloatingParticles />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
