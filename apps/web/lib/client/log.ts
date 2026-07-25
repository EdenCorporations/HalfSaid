'use client';

/**
 * Write utterances back into the PCG (SPEC §13.5, §14) via /v1/pcg/ingest, which
 * persists the Utterance AND (when a Groq key is set) extracts the entities it
 * mentions into new nodes+edges — so the graph grows from use and appears in the
 * clinician's conversation log. Best-effort: a failure never blocks speech.
 *
 * Two flavours:
 *  - logSpokenUtterance: an accepted/edited suggestion, after the undo window.
 *  - logInputUtterance: what the user typed or said into the mic — their own
 *    words are PCG material too (this is how the graph learns their phrasing).
 */

import { personaHeaders } from './persona';

async function ingest(content: string, mode: string, source: string): Promise<void> {
  try {
    // keepalive: the write survives page navigation (e.g. straight to the
    // clinician dashboard right after accepting).
    await fetch('/api/v1/pcg/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...personaHeaders() },
      body: JSON.stringify({ content, mode, source }),
      keepalive: true,
    });
  } catch {
    /* best-effort — do not surface logging errors to the user */
  }
}

export async function logSpokenUtterance(text: string): Promise<void> {
  await ingest(text, 'full_utterance', 'spoken');
}

export async function logInputUtterance(text: string): Promise<void> {
  await ingest(text, 'phrase', 'transcript');
}
