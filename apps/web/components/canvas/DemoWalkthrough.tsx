'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const WALKTHROUGH_KEY = 'halfsaid.walkthrough.v1';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'This is a Personal Communication Graph',
    body: 'Maya has aphasia. HalfSaid holds her PCG — 200+ nodes of the people, places, phrases and routines that make up how she speaks. Suggestions come from her life, not a generic model.',
  },
  {
    title: 'Speak or type a few words',
    body: 'Tap the mic (it stops by itself when you pause) or type. HalfSaid retrieves from the graph and drafts short sentences she might mean — even from half-said fragments.',
  },
  {
    title: 'Tap a card to speak it',
    body: 'Accepted phrases are spoken aloud. You have 5 seconds to undo — HalfSaid proposes, the user disposes. Keys 1–5 accept a card; important topics only ever use clinician-approved phrases.',
  },
  {
    title: 'Watch the graph learn',
    body: 'Every spoken phrase grows the PCG — watch the counter. The clinician dashboard shows the conversation log, session stats, and the living graph itself.',
  },
];

export interface DemoWalkthroughProps {
  open: boolean;
  onClose: () => void;
}

/**
 * First-visit guided tour (Enhancement 4) — frames the PCG narrative in four
 * steps. Accessible dialog: labelled, modal, Escape closes, focus moves in on
 * open and the trigger regains it naturally on close.
 */
export function DemoWalkthrough({ open, onClose }: DemoWalkthroughProps) {
  const [step, setStep] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      panelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const last = step === STEPS.length - 1;
  const current = STEPS[step]!;

  function finish() {
    try {
      window.localStorage.setItem(WALKTHROUGH_KEY, 'done');
    } catch {
      /* private mode */
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') finish();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-title"
        aria-describedby="walkthrough-body"
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-glow-soft focus-visible:outline-none"
      >
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tour · {step + 1} of {STEPS.length}
          </span>
        </div>

        <h2 id="walkthrough-title" className="font-heading text-xl font-semibold text-foreground">
          {current.title}
        </h2>
        <p id="walkthrough-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {current.body}
        </p>

        {/* Step dots. */}
        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={finish}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {last ? (
              <Button onClick={finish}>Start</Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
