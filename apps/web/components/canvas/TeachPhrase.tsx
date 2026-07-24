'use client';

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { personaHeaders } from '@/lib/client/persona';

export interface TeachPhraseProps {
  /** Called with the phrase after it lands in the PCG. */
  onTaught: (text: string) => void;
}

/**
 * "Teach a new phrase" (Enhancement 7) — the refusal path's constructive exit.
 * Instead of a dead end, the user (or a family member) adds the phrase straight
 * into the PCG via /v1/pcg/ingest, and it becomes retrievable immediately.
 */
export function TeachPhrase({ onTaught }: TeachPhraseProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phrase = text.trim();
    if (!phrase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/pcg/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...personaHeaders() },
        body: JSON.stringify({ content: phrase, mode: 'phrase' }),
      });
      if (!res.ok) throw new Error(`failed (${res.status})`);
      setText('');
      onTaught(phrase);
    } catch {
      setError('Could not save the phrase — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label
        htmlFor="teach-input"
        className="flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
        Teach a new phrase
      </label>
      <div className="flex gap-2">
        <input
          id="teach-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. water the roses"
          className="min-h-touch flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={busy || text.trim() === ''}>
          {busy ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
