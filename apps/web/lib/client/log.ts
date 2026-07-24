'use client';

/**
 * Ingest a spoken utterance into the PCG (SPEC §13.5, §14). Every accepted/edited
 * phrase is written back via /v1/pcg/ingest, which persists the Utterance AND (when
 * a Groq key is set) extracts the entities it mentions into new nodes+edges — so the
 * graph grows from use and appears in the clinician's conversation log. Best-effort:
 * a failure never blocks speech.
 */
export async function logSpokenUtterance(text: string): Promise<void> {
  try {
    await fetch('/api/v1/pcg/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text, mode: 'full_utterance' }),
    });
  } catch {
    /* best-effort — do not surface logging errors to the user */
  }
}
