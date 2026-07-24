'use client';

import { useEffect, useRef, useState } from 'react';
import type { SuggestionCandidate } from '@halfsaid/shared-types';
import { MAX_SUGGESTION_CARDS } from '@halfsaid/ui-tokens';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSuggestions } from '@/lib/client/useSuggestions';
import { useAsr } from '@/lib/client/useAsr';
import { speak } from '@/lib/client/tts';
import { logSpokenUtterance } from '@/lib/client/log';
import { InputBar } from './InputBar';
import { SuggestionCard } from './SuggestionCard';

const EMERGENCY_PHRASES = [
  'I need help.',
  'Call my daughter.',
  "I'm having chest pain.",
  'Call 911.',
];

/**
 * Screen 1 — Conversation Canvas (SPEC §13). The user provides context (typed here;
 * mic in the next commit), grounded suggestions arrive from /v1/suggestions, and a
 * tap speaks one in the user's voice.
 *
 * Accessibility: the transcript and status are aria-live regions; new suggestions
 * are announced but never steal focus mid-interaction; after an action, focus
 * returns to the input as a stable anchor.
 */
export function ConversationCanvas() {
  const { response, loading, error, request } = useSuggestions();
  const [transcript, setTranscript] = useState('');
  const [spoken, setSpoken] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<SuggestionCandidate | null>(null);
  const [editText, setEditText] = useState('');
  const [status, setStatus] = useState('');
  const [showEmergency, setShowEmergency] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const editRef = useRef<HTMLInputElement | null>(null);

  const candidates: SuggestionCandidate[] =
    response?.kind === 'candidates'
      ? response.candidates.filter((c) => !c.provenance.nodeIds.some((id) => dismissed.has(id)))
      : [];

  // Announce results without moving focus (SPEC §13 — don't steal focus).
  useEffect(() => {
    if (!response) return;
    if (response.kind === 'refusal') setStatus(response.reason);
    else
      setStatus(`${candidates.length} suggestion${candidates.length === 1 ? '' : 's'} available.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  function requestFor(text: string) {
    setTranscript(text);
    setDismissed(new Set());
    setShowEmergency(false);
    void request({ partialText: text, intent: 'request' });
  }

  // Microphone → Groq Whisper → transcript → suggestions.
  const asr = useAsr((text) => {
    if (text.trim()) requestFor(text);
  });

  function utter(text: string) {
    speak(text);
    void logSpokenUtterance(text); // persist to the PCG for the conversation log
    setSpoken((s) => [text, ...s]);
    setStatus(`Spoke: ${text}`);
    inputRef.current?.focus();
  }

  function accept(c: SuggestionCandidate) {
    utter(c.text);
  }
  function reject(c: SuggestionCandidate) {
    setDismissed((d) => new Set([...d, ...c.provenance.nodeIds]));
    setStatus('Suggestion dismissed.');
    inputRef.current?.focus();
  }
  function startEdit(c: SuggestionCandidate) {
    setEditing(c);
    setEditText(c.text);
  }
  function saveEdit() {
    const t = editText.trim();
    setEditing(null);
    if (t) utter(t);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Conversation Canvas</h1>
        <p className="text-sm text-muted-foreground">
          Say or type what you mean — HalfSaid suggests phrases from your own words.
        </p>
      </header>

      {/* Live transcript (SPEC §13 streaming-transcript live region). */}
      <section aria-label="Transcript" aria-live="polite" className="min-h-8 text-lg">
        {asr.listening && <span className="text-muted-foreground">Listening…</span>}
        {!asr.listening && asr.transcribing && (
          <span className="text-muted-foreground">Transcribing…</span>
        )}
        {!asr.listening && !asr.transcribing && transcript && (
          <span className="text-muted-foreground">You: {transcript}</span>
        )}
      </section>

      {/* Screen-reader status; visually hidden. */}
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>

      <section aria-label="Suggestions" aria-busy={loading} className="flex flex-1 flex-col gap-3">
        {loading && <p className="text-sm text-muted-foreground">Finding suggestions…</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Something went wrong: {error}
          </p>
        )}
        {asr.asrError && (
          <p role="alert" className="text-sm text-destructive">
            {asr.asrError}
          </p>
        )}

        {editing ? (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              <label htmlFor="edit-input" className="text-sm font-medium">
                Edit before speaking
              </label>
              <input
                id="edit-input"
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-touch rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <Button onClick={saveEdit} aria-label="Speak the edited phrase">
                  Speak
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          candidates
            .slice(0, MAX_SUGGESTION_CARDS)
            .map((c) => (
              <SuggestionCard
                key={c.provenance.nodeIds.join('-') + c.text}
                candidate={c}
                onAccept={accept}
                onEdit={startEdit}
                onReject={reject}
              />
            ))
        )}

        {response?.kind === 'refusal' && !editing && (
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="font-medium">{response.reason}</p>
              <p className="text-sm text-muted-foreground">You can:</p>
              <ul className="flex flex-wrap gap-2">
                {response.alternatives.map((alt) => (
                  <li key={alt}>
                    <span className="rounded-full bg-muted px-3 py-1 text-sm">{alt}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {showEmergency && (
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <h2 className="text-base font-semibold">Emergency phrases</h2>
              <div className="flex flex-col gap-2">
                {EMERGENCY_PHRASES.map((p) => (
                  <Button
                    key={p}
                    variant="destructive"
                    className="justify-start"
                    aria-label={`Speak: ${p}`}
                    onClick={() => utter(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {spoken.length > 0 && (
        <section aria-label="Spoken" className="text-sm text-muted-foreground">
          Last spoken: <span className="font-medium text-foreground">{spoken[0]}</span>
        </section>
      )}

      <InputBar
        onSubmitText={requestFor}
        onMic={asr.toggle}
        listening={asr.listening}
        onEmergency={() => setShowEmergency((s) => !s)}
        busy={loading || asr.transcribing}
        inputRef={inputRef}
      />
    </div>
  );
}
