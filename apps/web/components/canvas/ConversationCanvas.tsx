'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CircleHelp, Network, ShieldCheck } from 'lucide-react';
import type { SuggestionCandidate } from '@halfsaid/shared-types';
import { MAX_SUGGESTION_CARDS } from '@halfsaid/ui-tokens';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppShell } from '@/components/brand/AppShell';
import { CompanionOrb, type OrbState } from '@/components/brand/CompanionOrb';
import { PersonaSwitcher } from '@/components/brand/PersonaSwitcher';
import { PcgGrowthChip } from '@/components/pcg/PcgGrowthChip';
import { PcgMiniMap } from '@/components/pcg/PcgMiniMap';
import { useSuggestions } from '@/lib/client/useSuggestions';
import { useAsr } from '@/lib/client/useAsr';
import { speak, cancelSpeech } from '@/lib/client/tts';
import { logSpokenUtterance } from '@/lib/client/log';
import { getPersona } from '@/lib/client/persona';
import { InputBar } from './InputBar';
import { SuggestionCard } from './SuggestionCard';
import { VoiceButton } from './VoiceButton';
import { VoiceWave } from './VoiceWave';
import { SuggestionChip } from './SuggestionChip';
import { TeachPhrase } from './TeachPhrase';
import { UndoToast, UNDO_WINDOW_MS } from './UndoToast';
import { DemoWalkthrough, WALKTHROUGH_KEY } from './DemoWalkthrough';

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
 * Interaction contract:
 *  - Accept speaks immediately but persists to the PCG only after a 5s undo
 *    window (Dignity First — a wrong tap is recoverable).
 *  - Keys 1–5 accept a card, Ctrl+M (or M outside a field) toggles the mic,
 *    Escape closes panels. All shortcuts are additive; every action stays a
 *    real ≥44px button.
 *  - High-stakes topics (medication, legal, consent…) show a shield: only
 *    clinician-approved phrases are offered there.
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
  const [showGraph, setShowGraph] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<string | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [personaName, setPersonaName] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const editRef = useRef<HTMLInputElement | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoText = useRef<string | null>(null);

  const candidates: SuggestionCandidate[] =
    response?.kind === 'candidates'
      ? response.candidates.filter((c) => !c.provenance.nodeIds.some((id) => dismissed.has(id)))
      : [];

  // First visit → guided walkthrough (Enhancement 4); persona label after mount.
  useEffect(() => {
    setPersonaName(getPersona().name);
    try {
      if (!window.localStorage.getItem(WALKTHROUGH_KEY)) setWalkthroughOpen(true);
    } catch {
      /* private mode — skip the tour */
    }
  }, []);

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
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  function requestFor(text: string) {
    setTranscript(text);
    setDismissed(new Set());
    setShowEmergency(false);
    void request({ partialText: text, intent: 'request' });
  }

  // Microphone → Groq Whisper → transcript → suggestions. Interim text streams
  // live while recording; VAD auto-stops on silence (Enhancements 2 + 9).
  const asr = useAsr((text) => {
    if (text.trim()) requestFor(text);
  });

  /** Persist the pending utterance now (undo window elapsed or superseded). */
  const commitPendingUtterance = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    const text = undoText.current;
    undoText.current = null;
    setPendingUndo(null);
    if (text) {
      // After the PCG ingests it, refresh the growth counter/graph.
      void logSpokenUtterance(text).then(() => setGraphKey((k) => k + 1));
    }
  }, []);

  function utter(text: string) {
    // A second accept inside the window finalizes the previous one first.
    commitPendingUtterance();

    speak(text);
    setSpoken((s) => [text, ...s]);
    setStatus(`Spoke: ${text}`);
    setSpeaking(true);
    if (speakTimer.current) clearTimeout(speakTimer.current);
    const ms = Math.min(4000, Math.max(1200, text.split(/\s+/).length * 380));
    speakTimer.current = setTimeout(() => setSpeaking(false), ms);

    // Open the 5s undo window (Enhancement 3); persist only when it closes.
    undoText.current = text;
    setPendingUndo(text);
    undoTimer.current = setTimeout(commitPendingUtterance, UNDO_WINDOW_MS);

    inputRef.current?.focus();
  }

  function undo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    undoText.current = null;
    setPendingUndo(null);
    cancelSpeech();
    setSpeaking(false);
    setSpoken((s) => s.slice(1));
    setStatus('Undone — nothing was saved.');
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

  // Keyboard shortcuts (Enhancement 15) — additive, never hijack typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (e.key === 'Escape') {
        setShowEmergency(false);
        setEditing(null);
        return;
      }
      if ((e.ctrlKey && e.key.toLowerCase() === 'm') || (!typing && e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        asr.toggle();
        return;
      }
      if (typing || walkthroughOpen || editing) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        const c = candidates[n - 1];
        if (c) {
          e.preventDefault();
          utter(c.text);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, walkthroughOpen, editing, asr.toggle]);

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

  const highStakes = response?.highStakes === true;

  return (
    <AppShell>
      <DemoWalkthrough open={walkthroughOpen} onClose={() => setWalkthroughOpen(false)} />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#A855F7] shadow-glow" aria-hidden="true" />
            <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {personaName ? `${personaName}'s Conversation` : 'Conversation'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <PersonaSwitcher />
            <button
              type="button"
              aria-label="Replay the guided tour"
              onClick={() => setWalkthroughOpen(true)}
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link
              href="/clinician"
              className="inline-flex min-h-touch items-center rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clinician
            </Link>
          </div>
        </header>

        {/* Live PCG growth + graph toggle (Enhancements 6 + 11). */}
        <div className="flex items-center justify-center gap-2">
          <PcgGrowthChip refreshKey={graphKey} />
          <button
            type="button"
            aria-expanded={showGraph}
            onClick={() => setShowGraph((s) => !s)}
            className="glass inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Network className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {showGraph ? 'Hide my graph' : 'See my graph'}
          </button>
        </div>

        {showGraph && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            aria-label="Personal Communication Graph"
            className="glass overflow-hidden rounded-2xl p-4"
          >
            <PcgMiniMap height={300} refreshKey={graphKey} />
          </motion.section>
        )}

        {/* Companion + voice status. */}
        <section className="flex flex-col items-center gap-4 pt-2">
          <CompanionOrb state={orbState} size={220} />

          <p className="font-heading text-xl font-medium text-foreground" aria-hidden="true">
            {statusLabel}
          </p>

          <VoiceWave active={asr.listening || speaking} />

          {/* Live transcript (SPEC §13 streaming-transcript live region) — shows
              interim words as they are spoken (Enhancement 2). */}
          <section
            aria-label="Transcript"
            aria-live="polite"
            className="min-h-8 max-w-lg text-center text-lg"
          >
            {asr.listening && asr.interim && (
              <span className="text-foreground/80">{asr.interim}</span>
            )}
            {asr.listening && !asr.interim && (
              <span className="text-muted-foreground">Listening…</span>
            )}
            {!asr.listening && asr.transcribing && (
              <span className="text-muted-foreground">Transcribing…</span>
            )}
            {!asr.listening && !asr.transcribing && transcript && (
              <span className="text-foreground/90">You: {transcript}</span>
            )}
          </section>

          <VoiceButton
            listening={asr.listening}
            busy={loading || asr.transcribing}
            onClick={asr.toggle}
          />
          <p className="text-sm text-muted-foreground">
            Tap to speak — it stops on its own when you pause
          </p>
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
          {highStakes && (
            <p className="glass flex items-center gap-2 self-center rounded-full px-3 py-1.5 text-xs text-foreground">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              Important topic — only clinician-approved phrases are offered
              {response?.highStakesCategory ? ` (${response.highStakesCategory})` : ''}.
            </p>
          )}

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
                <label htmlFor="edit-input" className="text-sm font-medium text-foreground">
                  Edit before speaking
                </label>
                <input
                  id="edit-input"
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-touch rounded-xl border border-white/10 bg-white/5 px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              {candidates.slice(0, MAX_SUGGESTION_CARDS).map((c, i) => (
                <SuggestionCard
                  key={c.provenance.nodeIds.join('-') + c.text}
                  candidate={c}
                  index={i}
                  onAccept={accept}
                  onEdit={startEdit}
                  onReject={reject}
                />
              ))}
            </AnimatePresence>
          )}

          {response?.kind === 'refusal' && !editing && (
            <Card>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-2">
                  <p className="font-medium text-foreground">{response.reason}</p>
                  <p className="text-sm text-muted-foreground">You can:</p>
                  <ul className="flex flex-wrap gap-2">
                    {response.alternatives.map((alt, i) => (
                      <li key={alt}>
                        <SuggestionChip index={i}>{alt}</SuggestionChip>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Constructive exit: grow the graph right here (Enhancement 7). */}
                <TeachPhrase
                  onTaught={(phrase) => {
                    setStatus(`Added "${phrase}" to the graph — it can be suggested now.`);
                    setGraphKey((k) => k + 1);
                    if (transcript) requestFor(transcript);
                  }}
                />
              </CardContent>
            </Card>
          )}

          {showEmergency && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-5">
                <h2 className="text-base font-semibold text-foreground">Emergency phrases</h2>
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
            Last spoken: <span className="font-medium text-foreground">{spoken[0]}</span>
          </motion.section>
        )}

        <AnimatePresence>
          {pendingUndo && <UndoToast text={pendingUndo} onUndo={undo} />}
        </AnimatePresence>

        <InputBar
          onSubmitText={requestFor}
          onEmergency={() => setShowEmergency((s) => !s)}
          busy={loading || asr.transcribing}
          inputRef={inputRef}
        />
        <p className="text-center text-xs text-muted-foreground" aria-hidden="true">
          Shortcuts: 1–5 accept a card · M microphone · Esc close
        </p>
      </div>
    </AppShell>
  );
}
