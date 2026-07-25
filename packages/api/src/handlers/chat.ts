/**
 * POST /v1/pcg/chat — the graph-building companion (chat only, no speech).
 *
 * The user tells HalfSaid about their life in plain conversation. EVERY user
 * message is ingested into the PCG through the same pipeline as speech (utterance
 * node + embedding + extracted Person/Place/Object/Topic nodes + intent edge),
 * then a companion LLM replies: it acknowledges what was just saved and asks one
 * short follow-up that draws out more graph material.
 *
 * The reply is conversational chrome, never speech attributed to the user — the
 * Hard Rule concerns don't apply to it. Without a Groq key the ingest still runs
 * and a deterministic acknowledgement is returned (CI/offline safe).
 */

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed, readJson } from '../http';
import { ingestUtterance, type IngestResult } from './ingest';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBody {
  message: string;
  /** Prior turns for conversational continuity (most recent last). */
  history?: ChatTurn[];
}

function summarizeLinked(entities: IngestResult['entities']): string {
  const parts: string[] = [];
  if (entities.people.length) parts.push(`people: ${entities.people.join(', ')}`);
  if (entities.places.length) parts.push(`places: ${entities.places.join(', ')}`);
  if (entities.objects.length) parts.push(`objects: ${entities.objects.join(', ')}`);
  if (entities.topics.length) parts.push(`topics: ${entities.topics.join(', ')}`);
  return parts.join('; ');
}

/** Deterministic reply for the no-key (mock/CI) path. */
function fallbackReply(result: IngestResult): string {
  if (result.deduped) return 'I already have that one saved. Tell me something else!';
  const linked = summarizeLinked(result.entities);
  return linked
    ? `Saved — I added ${linked} to your graph. What else should I know?`
    : 'Saved that to your graph. Tell me more — people, places, routines, anything.';
}

async function companionReply(
  deps: ApiDeps,
  history: ChatTurn[],
  message: string,
  result: IngestResult,
): Promise<string> {
  if (!deps.llmApiKey) return fallbackReply(result);
  const doFetch = deps.llmFetch ?? fetch;
  const linked = summarizeLinked(result.entities);
  const system =
    'You are HalfSaid, a warm companion helping build a Personal Communication Graph ' +
    'for a person with aphasia. Their family/carer is telling you about their life. ' +
    'Reply in 1–2 short sentences: briefly confirm what you understood' +
    (linked ? ` (you just saved ${linked})` : '') +
    ', then ask ONE simple follow-up question that would surface more people, places, ' +
    'routines, or favorite phrases. Never give medical advice. Plain, kind language.';
  try {
    const res = await doFetch(GROQ_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${deps.llmApiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.6,
        max_tokens: 160,
        messages: [
          { role: 'system', content: system },
          ...history.slice(-8),
          { role: 'user', content: message },
        ],
      }),
    });
    if (!res.ok) return fallbackReply(result);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply || fallbackReply(result);
  } catch {
    return fallbackReply(result);
  }
}

export async function handleChat(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);
  const exec = deps.executorFor(userId);

  const body = await readJson<ChatBody>(req);
  if (!body || typeof body.message !== 'string' || body.message.trim() === '') {
    return apiError('message (non-empty string) is required', 400);
  }
  const history = Array.isArray(body.history)
    ? body.history.filter(
        (t): t is ChatTurn =>
          Boolean(t) &&
          (t.role === 'user' || t.role === 'assistant') &&
          typeof t.content === 'string',
      )
    : [];

  // Ingest first — the graph grows even if the reply fails.
  const result = await ingestUtterance(deps, exec, userId, body.message.trim(), 'chat', 'chat');
  const reply = await companionReply(deps, history, body.message.trim(), result);

  return json(
    {
      reply,
      utteranceId: result.utteranceId,
      linked: result.linked,
      deduped: result.deduped,
      entities: result.entities,
    },
    201,
  );
}
