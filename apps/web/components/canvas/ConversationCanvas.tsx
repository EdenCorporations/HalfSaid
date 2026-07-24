'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { SuggestionCandidate } from '@halfsaid/shared-types';
import { MAX_SUGGESTION_CARDS } from '@halfsaid/ui-tokens';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppShell } from '@/components/brand/AppShell';
import { CompanionOrb, type OrbState } from '@/components/brand/CompanionOrb';
import { useSuggestions } from '@/lib/client/useSuggestions';
import { useAsr } from '@/lib/client/useAsr';
import { speak } from '@/lib/client/tts';
import { logSpokenUtterance } from '@/lib/client/log';
import { InputBar } from './InputBar';
import { SuggestionCard } from './SuggestionCard';
import { VoiceButton } from './VoiceButton';
import { VoiceWave } from './VoiceWave';
import { SuggestionChip } from './SuggestionChip';

const EMERGENCY_PHRASES = [
  'I need help.',
  'Call my daughter.',
  "I'm having chest pain.",
  'Call 911.',
];

/**
 * Screen 1 — Conversation Canvas (SPEC §13). The user provides context (typed or
 * spoken), grounded suggestions arrive from /v1/suggestions, and a tap speaks one
 * in the user's voice.
 *
 * Accessibility: the transcript and status are aria-live regions; new suggestions
 * are announced but never steal focus mid-interaction; after an action, focus
 * returns to the input as a stable anchor. The visual redesign (companion orb,
 * waveform, glass) is presentational — logic and the a11y contract are unchanged.
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
  const [speaking, setSpeaking] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const editRef = useRef<HTMLInputElement | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(
    () => () => {
      if (speakTimer.current) clearTimeout(speakTimer.current);
    },
    [],
  );

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
    // Presentational: reflect a brief "speaking" state on the orb.
    setSpeaking(true);
    if (speakTimer.current) clearTimeout(speakTimer.current);
    const ms = Math.min(4000, Math.max(1200, text.split(/\s+/).length * 380));
    speakTimer.current = setTimeout(() => setSpeaking(false), ms);
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

  const orbState: OrbState = asr.listening
    ? 'listening'
    : loading || asr.transcribing
      ? 'thinking'
      : speaking
        ? 'speaking'
        : 'idle';

  const statusLabel = asr.listening
    ? 'Listening…'
    : asr.transcribing
      ? 'Transcribing…'
      : loading
        ? 'Thinking…'
        : speaking
          ? 'Speaking…'
          : 'Ready when you are';

  return (
    <AppShell>
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#A855F7] shadow-glow" aria-hidden="true" />
            <h1 className="font-heading text-lg font-semibold tracking-tight text-white">
              Conversation
            </h1>
          </div>
          <Link
            href="/clinician"
            className="inline-flex min-h-touch items-center rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clinician
          </Link>
        </header>

        {/* Companion + voice status. */}
        <section className="flex flex-col items-center gap-4 pt-2">
          <CompanionOrb state={orbState} size={220} />

          <p className="font-heading text-xl font-medium text-white" aria-hidden="true">
            {statusLabel}
          </p>

          <VoiceWave active={asr.listening || speaking} />

          {/* Live transcript (SPEC §13 streaming-transcript live region). */}
          <section
            aria-label="Transcript"
            aria-live="polite"
            className="min-h-8 text-center text-lg"
          >
            {asr.listening && <span className="text-muted-foreground">Listening…</span>}
            {!asr.listening && asr.transcribing && (
              <span className="text-muted-foreground">Transcribing…</span>
            )}
            {!asr.listening && !asr.transcribing && transcript && (
              <span className="text-white/90">You: {transcript}</span>
            )}
          </section>

          <VoiceButton
            listening={asr.listening}
            busy={loading || asr.transcribing}
            onClick={asr.toggle}
          />
          <p className="text-sm text-muted-foreground">Tap to speak, or type below</p>
        </section>

        {/* Screen-reader status; visually hidden. */}
        <div role="status" aria-live="polite" className="sr-only">
          {status}
        </div>

        <section
          aria-label="Suggestions"
          aria-busy={loading}
          className="flex flex-1 flex-col gap-3"
        >
          {loading && (
            <p className="text-center text-sm text-muted-foreground">Finding suggestions…</p>
          )}
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
              <CardContent className="flex flex-col gap-3 p-5">
                <label htmlFor="edit-input" className="text-sm font-medium text-white">
                  Edit before speaking
                </label>
                <input
                  id="edit-input"
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-touch rounded-xl border border-white/10 bg-white/5 px-3 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <AnimatePresence mode="popLayout">
              {candidates.slice(0, MAX_SUGGESTION_CARDS).map((c) => (
                <SuggestionCard
                  key={c.provenance.nodeIds.join('-') + c.text}
                  candidate={c}
                  onAccept={accept}
                  onEdit={startEdit}
                  onReject={reject}
                />
              ))}
            </AnimatePresence>
          )}

          {response?.kind === 'refusal' && !editing && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-5">
                <p className="font-medium text-white">{response.reason}</p>
                <p className="text-sm text-muted-foreground">You can:</p>
                <ul className="flex flex-wrap gap-2">
                  {response.alternatives.map((alt, i) => (
                    <li key={alt}>
                      <SuggestionChip index={i}>{alt}</SuggestionChip>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {showEmergency && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-5">
                <h2 className="text-base font-semibold text-white">Emergency phrases</h2>
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
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            aria-label="Spoken"
            className="text-sm text-muted-foreground"
          >
            Last spoken: <span className="font-medium text-white">{spoken[0]}</span>
          </motion.section>
        )}

        <InputBar
          onSubmitText={requestFor}
          onEmergency={() => setShowEmergency((s) => !s)}
          busy={loading || asr.transcribing}
          inputRef={inputRef}
        />
      </div>
    </AppShell>
  );
}
