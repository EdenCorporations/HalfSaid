import { Mic, Keyboard, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MAX_SUGGESTION_CARDS } from '@halfsaid/ui-tokens';
import { CONFIDENCE } from '@halfsaid/safety-policy';

/**
 * Screen 1 — Conversation Canvas (SPEC §13). Phase 1 renders the skeleton only:
 * context header, an (empty) suggestion region, and the input bar. Streaming ASR,
 * retrieval, and real grounded suggestion cards arrive in Phases 3–5. No fabricated
 * suggestions or provenance are shown.
 */
export default function CanvasPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Conversation Canvas</h1>
        <p className="text-sm text-muted-foreground">
          Context: partner and topic appear here during a live conversation.
        </p>
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Phase 1 scaffold — up to {MAX_SUGGESTION_CARDS} grounded cards will render here once
          retrieval is wired (ship ≥ {CONFIDENCE.SHIP}, sandbox ≥ {CONFIDENCE.SANDBOX_FLOOR}).
        </p>
      </header>

      {/* Streaming transcript will use an aria-live region (SPEC §13). */}
      <section aria-label="Live transcript" aria-live="polite" className="min-h-8 text-lg" />

      <section aria-label="Suggestions" className="flex flex-1 flex-col gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No suggestions yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Suggestion cards (candidate, source tag, confidence bar, accept / edit / reject) are
            implemented in Phase 5.
          </CardContent>
        </Card>
      </section>

      {/* Input bar: mic, type, emergency (SPEC §13). Disabled in the scaffold. */}
      <div className="sticky bottom-4 flex items-center justify-between gap-2 rounded-lg border bg-card p-2">
        <Button size="icon" variant="outline" aria-label="Speak" disabled>
          <Mic aria-hidden="true" className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="outline" aria-label="Type" disabled>
          <Keyboard aria-hidden="true" className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="destructive" aria-label="Emergency" disabled>
          <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
