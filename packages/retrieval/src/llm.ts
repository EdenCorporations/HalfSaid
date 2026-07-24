/**
 * LLM-first suggestion generation (SPEC deviation D20). The LLM writes short,
 * first-person sentences the user might want to say. Retrieved PCG items are passed
 * as *context* about the person's life (who they talk to, where they go, things
 * they've said) — information, not a word-whitelist. Works on a cold start with
 * little or no PCG; any context used is recorded as provenance.
 *
 * Internal op only in the safety sense: the model output IS the user-facing text
 * now (per the owner's decision), grounded in PCG context when available.
 */

import { composeGenerated } from '@halfsaid/safety-policy';
import type { SuggestionCandidate } from '@halfsaid/shared-types';
import type { RetrievedCandidate, SuggestionContext } from './types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export interface LlmGenOptions {
  apiKey: string;
  model?: string;
  count?: number;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function buildMessages(ctx: SuggestionContext, context: RetrievedCandidate[], count: number) {
  const said = context
    .slice(0, 12)
    .map((c) => `- ${c.content}`)
    .join('\n');
  const system =
    'You help a person with aphasia say what they mean. They can only tap a suggestion, ' +
    'so write short, natural, first-person sentences they might want to say right now. Use ' +
    'the context about their life when it fits, but everyday phrases are fine too. Keep each ' +
    `under 12 words. Return ONLY JSON: {"suggestions": ["...", ...]} with exactly ${count} items.`;
  const user =
    (said ? `Things they've said before:\n${said}\n\n` : '') +
    `They are starting to say: "${ctx.partialText}".` +
    (ctx.intent ? ` Their intent seems to be: ${ctx.intent}.` : '') +
    `\nSuggest ${count} short first-person sentences.`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function parseSuggestions(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { suggestions?: unknown }).suggestions)
    ) {
      return (parsed as { suggestions: unknown[] }).suggestions.filter(
        (s): s is string => typeof s === 'string',
      );
    }
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    /* fall through */
  }
  return [];
}

export async function generateSuggestions(
  ctx: SuggestionContext,
  context: RetrievedCandidate[],
  opts: LlmGenOptions,
): Promise<SuggestionCandidate[]> {
  const count = opts.count ?? 3;
  const doFetch = opts.fetchImpl ?? fetch;

  const res = await doFetch(GROQ_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages: buildMessages(ctx, context, count),
      temperature: 0.5,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`groq generation failed (${res.status})`);

  const data = (await res.json()) as GroqChatResponse;
  const sentences = parseSuggestions(data.choices?.[0]?.message?.content ?? '')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, count);

  // Grounding = the context items that informed the generation (may be empty).
  const groundingNodeIds = context.slice(0, 12).map((c) => c.nodeId);
  const confidence = context.length > 0 ? 0.82 : 0.7; // grounded ships; cold-start sandboxes

  const candidates: SuggestionCandidate[] = [];
  for (const text of sentences) {
    const candidate = composeGenerated({
      text,
      groundingNodeIds,
      sourceTag: 'yours',
      confidence,
      mode: 'full_utterance',
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
