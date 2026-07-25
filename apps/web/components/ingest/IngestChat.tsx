'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircleHeart, Network, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/brand/AppShell';
import { PersonaSwitcher } from '@/components/brand/PersonaSwitcher';
import { PcgGrowthChip } from '@/components/pcg/PcgGrowthChip';
import { PcgMiniMap } from '@/components/pcg/PcgMiniMap';
import { getPersona, personaHeaders } from '@/lib/client/persona';

interface Entities {
  people: string[];
  places: string[];
  objects: string[];
  topics: string[];
}

interface ChatResponse {
  reply: string;
  linked: number;
  deduped?: boolean;
  entities: Entities;
}

interface Bubble {
  role: 'user' | 'assistant';
  content: string;
  entities?: Entities;
}

const ENTITY_STYLES: Array<{ key: keyof Entities; label: string; className: string }> = [
  { key: 'people', label: 'Person', className: 'text-[#F472B6] border-[#F472B6]/40' },
  { key: 'places', label: 'Place', className: 'text-[#34D399] border-[#34D399]/40' },
  { key: 'objects', label: 'Object', className: 'text-[#FBBF24] border-[#FBBF24]/40' },
  { key: 'topics', label: 'Topic', className: 'text-[#60A5FA] border-[#60A5FA]/40' },
];

/**
 * The graph-building companion (chat only — nothing here is ever spoken). Family,
 * carers, or the user type facts about their life; every message is ingested into
 * the PCG (nodes + edges + embeddings) and the companion acknowledges what it
 * saved and asks for more. The growth chip and mini-map update live, so you can
 * literally watch the graph learn.
 *
 * Accessibility: the thread is a labelled aria-live log (new replies are
 * announced), the composer has a real label, and every control is ≥44px.
 */
export function IngestChat() {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [showGraph, setShowGraph] = useState(false);
  const [personaName, setPersonaName] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPersonaName(getPersona().name);
  }, []);

  useEffect(() => {
    // Guarded: jsdom has no scrollIntoView.
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError(null);
    setBusy(true);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/v1/pcg/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...personaHeaders() },
        body: JSON.stringify({ message: text, history: history.slice(-8) }),
      });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
      const data = (await res.json()) as ChatResponse;
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.reply, entities: data.entities },
      ]);
      setGraphKey((k) => k + 1);
    } catch {
      setError('That didn’t save — try again.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/canvas"
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Canvas
          </Link>
          <div className="flex items-center gap-2">
            <MessageCircleHeart className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Teach HalfSaid
            </h1>
          </div>
          <PersonaSwitcher />
        </header>

        <div className="flex items-center justify-center gap-2">
          <PcgGrowthChip refreshKey={graphKey} />
          <button
            type="button"
            aria-expanded={showGraph}
            onClick={() => setShowGraph((s) => !s)}
            className="glass inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Network className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {showGraph ? 'Hide the graph' : 'Watch the graph'}
          </button>
        </div>

        {showGraph && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            aria-label="Personal Communication Graph"
            className="glass overflow-hidden rounded-2xl p-4"
          >
            <PcgMiniMap height={260} refreshKey={graphKey} />
          </motion.section>
        )}

        <section
          aria-label="Conversation with the graph companion"
          role="log"
          aria-live="polite"
          className="flex flex-1 flex-col gap-3 overflow-y-auto"
        >
          {messages.length === 0 && (
            <div className="glass mx-auto mt-6 max-w-md rounded-2xl p-5 text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tell me about {personaName ? `${personaName}'s` : 'their'} life — people, places,
                routines, favorite phrases. Everything you share becomes part of the Personal
                Communication Graph and shapes future suggestions.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Try: “Her granddaughter Nora visits every Sunday and they bake scones.”
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <motion.div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={m.role === 'user' ? 'self-end' : 'self-start'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground'
                    : 'glass max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-foreground'
                }
              >
                <p className="text-sm leading-relaxed">{m.content}</p>
              </div>
              {m.entities && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Added to the graph">
                  {ENTITY_STYLES.flatMap(({ key, label, className }) =>
                    (m.entities?.[key] ?? []).map((name) => (
                      <li
                        key={`${key}-${name}`}
                        className={`rounded-full border bg-white/5 px-2 py-0.5 text-[11px] ${className}`}
                      >
                        + {label}: {name}
                      </li>
                    )),
                  )}
                </ul>
              )}
            </motion.div>
          ))}
          {busy && <p className="text-sm text-muted-foreground">Adding to the graph…</p>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div ref={endRef} />
        </section>

        <form
          onSubmit={send}
          className="glass-strong sticky bottom-4 flex items-center gap-2 rounded-2xl p-2 shadow-glow-soft"
        >
          <label htmlFor="chat-input" className="sr-only">
            Tell HalfSaid something about their life
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share something about their life…"
            className="min-h-touch flex-1 rounded-xl border border-transparent bg-transparent px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" aria-label="Send" disabled={busy || input.trim() === ''}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Send
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
