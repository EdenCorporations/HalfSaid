/**
 * End-to-end suggestion (SPEC §5–§8, deviation D20).
 *
 * Primary path (when a Groq key is available): retrieve PCG items as CONTEXT, then
 * the LLM writes short first-person sentences grounded in that context — it works on
 * a cold start with little or no PCG, and the PCG is used as information, not a
 * word-whitelist.
 *
 * Fallback path (no key, e.g. CI/offline): constrained decoding straight from PCG
 * items via @halfsaid/safety-policy's buildCandidate — the original safe behaviour.
 *
 * High-stakes contexts (SPEC §7.3) always use the constrained fallback, never
 * free generation. When nothing surfaces, the first-class refusal path fires.
 */

import { buildCandidate, assertGrounded } from '@halfsaid/safety-policy';
import type { SuggestionCandidate, SuggestionsResponse } from '@halfsaid/shared-types';

import { getEmbedder, type Embedder } from './embeddings';
import { retrieve } from './retrieve';
import { rank, INITIAL_WEIGHTS, type RankerWeights } from './ranker';
import { scoreConfidence, toSourceItem } from './confidence';
import { generateSuggestions } from './llm';
import type { SqlExecutor } from './sql';
import type { SuggestionContext } from './types';

export interface SuggestOptions {
  embedder?: Embedder;
  weights?: RankerWeights;
  /** Epoch seconds for recency (defaults to now). */
  nowEpoch?: number;
  /** Max cards to surface (SPEC §13 cognitive-load budget). */
  maxCards?: number;
  /** Groq key — when set, the LLM writes the suggestions (D20). */
  groqApiKey?: string;
  llmModel?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

const REFUSAL_ALTERNATIVES = ['Type it out', 'Switch input mode', 'Ask your SLP'];

function refusal(): SuggestionsResponse {
  return {
    kind: 'refusal',
    reason: "I don't have a confident suggestion.",
    alternatives: REFUSAL_ALTERNATIVES,
  };
}

export async function suggest(
  exec: SqlExecutor,
  ctx: SuggestionContext,
  options: SuggestOptions = {},
): Promise<SuggestionsResponse> {
  const embedder = options.embedder ?? getEmbedder();
  const weights = options.weights ?? INITIAL_WEIGHTS;
  const nowEpoch = options.nowEpoch ?? Math.floor(Date.now() / 1000);
  const maxCards = options.maxCards ?? 5;

  // Retrieve PCG items — as generation context (primary) or as the candidate pool
  // (fallback). Policy filters (incl. high-stakes) already applied.
  const retrieved = await retrieve(exec, ctx, embedder, { topK: 12 });

  // Primary: LLM writes the sentences, grounded in retrieved context. Not used for
  // high-stakes, which stays on the constrained path.
  if (options.groqApiKey && !ctx.highStakes) {
    try {
      const generated = await generateSuggestions(ctx, retrieved, {
        apiKey: options.groqApiKey,
        model: options.llmModel,
        count: maxCards,
        fetchImpl: options.fetchImpl,
      });
      const cards = generated.slice(0, maxCards);
      if (cards.length > 0) return { kind: 'candidates', candidates: cards };
      // LLM returned nothing usable — fall through to the constrained path.
    } catch {
      // LLM/network failure — fall back to constrained retrieval below.
    }
  }

  // Fallback: constrained decoding straight from PCG items.
  const ranked = rank(retrieved, ctx, weights, nowEpoch, retrieved.length);
  const kept = ranked.map(scoreConfidence).filter((s) => s.gate !== 'refuse');
  if (kept.length === 0) return refusal();

  const candidates: SuggestionCandidate[] = [];
  for (const scored of kept.slice(0, maxCards)) {
    const candidate = buildCandidate({
      sourceItems: [toSourceItem(scored.ranked)],
      mode: scored.ranked.candidate.mode,
      confidence: scored.confidence,
      edgeIds: [],
    });
    if (!candidate) continue;
    assertGrounded(candidate);
    candidates.push(candidate);
  }

  return candidates.length > 0 ? { kind: 'candidates', candidates } : refusal();
}
