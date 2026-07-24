'use client';

import { useRef } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SuggestionCandidate } from '@halfsaid/shared-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfidenceBar } from './ConfidenceBar';
import { SourceTagBadge } from './SourceTagBadge';

const LONG_PRESS_MS = 550;

export interface SuggestionCardProps {
  candidate: SuggestionCandidate;
  /** Position in the list (stagger + the 1–5 keyboard hint). */
  index?: number;
  onAccept: (candidate: SuggestionCandidate) => void;
  onEdit: (candidate: SuggestionCandidate) => void;
  onReject: (candidate: SuggestionCandidate) => void;
}

/**
 * A suggestion card (SPEC §13 Screen 1). Shows the candidate, its source tag,
 * confidence bar, and provenance explanation, with Accept / Edit / Dismiss actions.
 *
 * Accessibility (AAA on the acceptance path): each action is a real ≥44px button
 * with a descriptive accessible name; the whole card is a group labelled by the
 * candidate text; reject is neutrally "Dismiss" (no guilt). Long-press anywhere on
 * the card opens Edit — a touch enhancement layered on top of the always-present
 * Edit button, never a replacement for it. Keys 1–5 accept the matching card.
 */
export function SuggestionCard({
  candidate,
  index = 0,
  onAccept,
  onEdit,
  onReject,
}: SuggestionCardProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function pressStart() {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onEdit(candidate);
    }, LONG_PRESS_MS);
  }
  function pressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, delay: index * 0.06 }}
    >
      <Card
        role="group"
        aria-label={`Suggestion: ${candidate.text}`}
        className="w-full transition-shadow hover:shadow-glow"
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        onPointerCancel={pressEnd}
      >
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xl font-semibold leading-snug text-foreground">{candidate.text}</p>
            <div className="flex shrink-0 items-center gap-2">
              <SourceTagBadge tag={candidate.sourceTag} />
              {index < 5 && (
                <kbd
                  aria-hidden="true"
                  className="hidden rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-block"
                >
                  {index + 1}
                </kbd>
              )}
            </div>
          </div>

          <ConfidenceBar confidence={candidate.confidence} gate={candidate.gate} />

          <p className="text-xs text-muted-foreground">{candidate.explanation}</p>

          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              aria-label={`Accept and speak: ${candidate.text}`}
              onClick={() => {
                if (!longPressed.current) onAccept(candidate);
              }}
            >
              <Check aria-hidden="true" className="h-5 w-5" />
              Accept
            </Button>
            <Button
              variant="outline"
              aria-label={`Edit before speaking: ${candidate.text}`}
              onClick={() => onEdit(candidate)}
            >
              <Pencil aria-hidden="true" className="h-5 w-5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              aria-label={`Dismiss suggestion: ${candidate.text}`}
              onClick={() => onReject(candidate)}
            >
              <X aria-hidden="true" className="h-5 w-5" />
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
