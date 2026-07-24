'use client';

import { Mic, Square } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface VoiceButtonProps {
  listening?: boolean;
  busy?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * The primary microphone control — a large Siri-style orb with a continuous
 * breathing pulse and expanding ripples while listening. Accessibility is
 * preserved: it is a real ≥64px button, reflects state via aria-pressed, and
 * carries a descriptive accessible name. Ripples are decorative and stop under
 * prefers-reduced-motion.
 */
export function VoiceButton({
  listening = false,
  busy = false,
  onClick,
  disabled,
}: VoiceButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Expanding ripples while listening. */}
      {listening && (
        <>
          <span className="pointer-events-none absolute h-24 w-24 rounded-full bg-[#A855F7]/30 animate-pulse-ring" />
          <span
            className="pointer-events-none absolute h-24 w-24 rounded-full bg-[#A855F7]/20 animate-pulse-ring"
            style={{ animationDelay: '0.9s' }}
          />
        </>
      )}
      <button
        type="button"
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Speak'}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'relative flex h-24 w-24 items-center justify-center rounded-full text-white transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          listening
            ? 'bg-gradient-to-br from-[#EF4444] to-[#9333EA] shadow-glow-lg'
            : 'bg-gradient-to-br from-[#7C3AED] to-[#9333EA] shadow-glow hover:shadow-glow-lg hover:scale-[1.04]',
          !listening && !busy && 'motion-safe:animate-breathe',
        )}
      >
        {listening ? (
          <Square className="h-9 w-9" aria-hidden="true" />
        ) : (
          <Mic className="h-9 w-9" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
