'use client';

/**
 * Persist a spoken utterance to the PCG (SPEC §14). Every accepted/edited phrase the
 * user speaks is written as an Utterance node via /v1/pcg/nodes, so it appears in the
 * clinician's conversation log. Best-effort: a logging failure never blocks speech.
 */
export async function logSpokenUtterance(text: string): Promise<void> {
  try {
    await fetch('/api/v1/pcg/nodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nodeType: 'Utterance',
        attributes: { content: text, mode: 'full_utterance', source: 'spoken' },
        privacyTier: 2,
      }),
    });
  } catch {
    /* best-effort — do not surface logging errors to the user */
  }
}
