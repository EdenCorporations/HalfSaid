'use client';

import { useState, type RefObject } from 'react';
import { Keyboard, Mic, Square, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface InputBarProps {
  onSubmitText: (text: string) => void;
  onMic?: () => void;
  onEmergency: () => void;
  listening?: boolean;
  busy?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The Canvas input bar (SPEC §13): mic, type, and emergency. All controls are real
 * >=44px keyboard-operable buttons; the text field has a real (visually hidden)
 * label; the mic reflects its state via aria-pressed.
 */
export function InputBar({
  onSubmitText,
  onMic,
  onEmergency,
  listening = false,
  busy = false,
  inputRef,
}: InputBarProps) {
  const [text, setText] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed) onSubmitText(trimmed);
  }

  return (
    <div className="sticky bottom-4 flex items-center gap-2 rounded-lg border bg-card p-2">
      <Button
        type="button"
        size="icon"
        variant={listening ? 'default' : 'outline'}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Speak'}
        onClick={onMic}
        disabled={!onMic}
      >
        {listening ? (
          <Square aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Mic aria-hidden="true" className="h-5 w-5" />
        )}
      </Button>

      <form onSubmit={submit} className="flex flex-1 items-center gap-2">
        <label htmlFor="canvas-input" className="sr-only">
          Type what you want to say
        </label>
        <span className="text-muted-foreground" aria-hidden="true">
          <Keyboard className="h-5 w-5" />
        </span>
        <input
          id="canvas-input"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type what you want to say…"
          className="min-h-touch flex-1 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
