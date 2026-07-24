'use client';

import { useState, type RefObject } from 'react';
import { Keyboard, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface InputBarProps {
  onSubmitText: (text: string) => void;
  onEmergency: () => void;
  busy?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The Canvas input bar (SPEC §13): type + emergency. Voice lives in the primary
 * VoiceButton above. All controls are real >=44px keyboard-operable buttons; the
 * text field has a real (visually hidden) label. Restyled as a floating glass bar
 * — the visual change is presentational only.
 */
export function InputBar({ onSubmitText, onEmergency, busy = false, inputRef }: InputBarProps) {
  const [text, setText] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed) onSubmitText(trimmed);
  }

  return (
    <div className="glass-strong sticky bottom-4 flex items-center gap-2 rounded-2xl p-2 shadow-glow-soft">
      <form onSubmit={submit} className="flex flex-1 items-center gap-2">
        <label htmlFor="canvas-input" className="sr-only">
          Type what you want to say
        </label>
        <span className="pl-2 text-muted-foreground" aria-hidden="true">
          <Keyboard className="h-5 w-5" />
        </span>
        <input
          id="canvas-input"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type what you want to say…"
          className="min-h-touch flex-1 rounded-xl border border-transparent bg-transparent px-2 text-base text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" aria-label="Get suggestions" disabled={busy || text.trim() === ''}>
          Go
        </Button>
      </form>

      <Button
        type="button"
        size="icon"
        variant="destructive"
        aria-label="Emergency phrases"
        onClick={onEmergency}
      >
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
      </Button>
    </div>
  );
}
