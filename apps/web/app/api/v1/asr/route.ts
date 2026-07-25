/**
 * POST /api/v1/asr — streaming-ASR proxy to Groq Whisper large-v3 (SPEC §2, PRD §16).
 *
 * The browser records audio and posts it here; the server forwards it to Groq using
 * GROQ_API_KEY (server-only, never exposed to the client) and returns the transcript.
 * This runs independently of HALFSAID_MOCK_MODE so real ASR works even with the mock
 * DB. MVP is record-then-transcribe (near-real-time), not token-streaming (D17).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return json({ error: 'ASR unavailable: GROQ_API_KEY is not set' }, 503);

  let audio: FormDataEntryValue | null;
  try {
    audio = (await req.formData()).get('audio');
  } catch {
    return json({ error: 'expected multipart/form-data with an audio file' }, 400);
  }
  if (!(audio instanceof Blob)) return json({ error: 'audio file is required' }, 400);

  const groqForm = new FormData();
  groqForm.append('file', audio, 'audio.webm');
  groqForm.append('model', 'whisper-large-v3');
  groqForm.append('language', 'en');
  groqForm.append('response_format', 'json');

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: groqForm,
    });
  } catch {
    return json({ error: 'could not reach Groq' }, 502);
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return json({ error: `Groq transcription failed (${res.status})`, detail }, 502);
  }

  const data = (await res.json()) as { text?: string };
  return json({ text: (data.text ?? '').trim() });
}
