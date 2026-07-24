'use client';

import { Check, Pencil, X } from 'lucide-react';
import type { SuggestionCandidate } from '@halfsaid/shared-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfidenceBar } from './ConfidenceBar';
import { SourceTagBadge } from './SourceTagBadge';

export interface SuggestionCardProps {
  candidate: SuggestionCandidate;
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
 * candidate text; reject is neutrally "Dismiss" (no guilt). Long-press-to-edit is a
 * touch enhancement layered on top of the always-present Edit button.
 */
export function SuggestionCard({ candidate, onAccept, onEdit, onReject }: SuggestionCardProps) {
  return (
    <Card role="group" aria-label={`Suggestion: ${candidate.text}`} className="w-full">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xl font-semibold leading-snug">{candidate.text}</p>
          <SourceTagBadge tag={candidate.sourceTag} />
        </div>

        <ConfidenceBar confidence={candidate.confidence} gate={candidate.gate} />

        <p className="text-xs text-muted-foreground">{candidate.explanation}</p>

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            aria-label={`Accept and speak: ${candidate.text}`}
            onClick={() => onAccept(candidate)}
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
  );
}
