/**
 * End-to-end suggestion (SPEC §5–§8). Orchestrates the pipeline into a
 * SuggestionsResponse:
 *
 *   retrieve -> rank -> confidence + gate -> constrained generation -> response
 *
 * The Hard Rule (SPEC §0, §8) is upheld structurally: every candidate is built ONLY
 * via @halfsaid/safety-policy's buildCandidate from a PCG source item. When nothing
 * clears the 0.5 confidence floor, the first-class refusal path fires (SPEC §7.2) —
 * that is correct behaviour, not an error.
 */

import { buildCandidate, assertGrounded } from '@halfsaid/safety-policy';
import type { SuggestionCandidate, SuggestionsResponse } from '@halfsaid/shared-types';

import { getEmbedder, type Embedder } from './embeddings';
import { retrieve } from './retrieve';
import { rank, INITIAL_WEIGHTS, type RankerWeights } from './ranker';
import { scoreConfidence, toSourceItem } from './confidence';
import type { SqlExecutor } from './sql';
import type { SuggestionContext } from './types';

export interface SuggestOptions {
  embedder?: Embedder;
  weights?: RankerWeights;
  /** Epoch seconds for recency (defaults to now). */
  nowEpoch?: number;
  /** Max cards to surface (SPEC §13 cognitive-load budget). */
  maxCards?: number;
}

const REFUSAL_ALTERNATIVES = ['Type it out', 'Switch input mode', 'Ask your SLP'];

export async function suggest(
  exec: SqlExecutor,
  ctx: SuggestionContext,
  options: SuggestOptions = {},
): Promise<SuggestionsResponse> {
  const embedder = options.embedder ?? getEmbedder();
  const weights = options.weights ?? INITIAL_WEIGHTS;
  const nowEpoch = options.nowEpoch ?? Math.floor(Date.now() / 1000);
  const maxCards = options.maxCards ?? 5;

  // Steps 1–4: retrieve a shortlist (policy-filtered, incl. high-stakes).
  const retrieved = await retrieve(exec, ctx, embedder, { topK: 20 });

  // Step 6: rank the whole shortlist; step 5: score + gate each, drop refusals.
  const ranked = rank(retrieved, ctx, weights, nowEpoch, retrieved.length);
  const kept = ranked.map(scoreConfidence).filter((s) => s.gate !== 'refuse');

  if (kept.length === 0) {
    return {
      kind: 'refusal',
      reason: "I don't have a confident suggestion.",
      alternatives: REFUSAL_ALTERNATIVES,
    };
  }

  const candidates: SuggestionCandidate[] = [];
  for (const scored of kept.slice(0, maxCards)) {
    // Constrained generation: the ONLY path from a PCG item to a user-facing card.
    const candidate = buildCandidate({
      sourceItems: [toSourceItem(scored.ranked)],
      mode: scored.ranked.candidate.mode,
      confidence: scored.confidence,
      edgeIds: [],
    });
    if (!candidate) continue; // below the sandbox floor — should not happen post-filter
    assertGrounded(candidate); // hallucination check (SPEC §8): must cite ≥1 PCG id
    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    return {
      kind: 'refusal',
      reason: "I don't have a confident suggestion.",
      alternatives: REFUSAL_ALTERNATIVES,
    };
  }

  return { kind: 'candidates', candidates };
}
