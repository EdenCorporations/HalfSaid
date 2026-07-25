/**
 * End-to-end suggestion (SPEC §5–§8, deviation D20).
 *
 * HYBRID: retrieved PCG phrases and LLM-written sentences are BLENDED into one
 * card list. The user's own phrases ("call Sarah") are first-class suggestions with
 * true provenance — not just invisible context — so a close match from the graph
 * always beats generic generation. The LLM fills the remaining cards with fluent
 * full sentences, grounded in the same retrieved context (cold-start safe).
 *
 * Fallback path (no key, e.g. CI/offline): constrained decoding only — the
 * original safe behaviour, fully deterministic.
 *
 * High-stakes contexts (SPEC §7.3) — forced OR detected from the text — always
 * use the constrained path, never free generation. When nothing surfaces, the
 * first-class refusal path fires.
 */

import { buildCandidate, assertGrounded, detectHighStakes } from '@halfsaid/safety-policy';
import type { SuggestionCandidate, SuggestionsResponse } from '@halfsaid/shared-types';

import { getEmbedder, type Embedder } from './embeddings';
import { retrieve } from './retrieve';
import { rank, INITIAL_WEIGHTS, type RankerWeights } from './ranker';
import { scoreConfidence, toSourceItem, type Scored } from './confidence';
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
  /** Groq key — when set, the LLM fills in cards alongside retrieval (D20). */
  groqApiKey?: string;
  llmModel?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

const REFUSAL_ALTERNATIVES = ['Type it out', 'Switch input mode', 'Ask your SLP'];

interface StakesInfo {
  highStakes?: boolean;
  highStakesCategory?: string;
}

function refusal(stakes: StakesInfo = {}): SuggestionsResponse {
  return {
    kind: 'refusal',
    reason: stakes.highStakes
      ? 'This sounds important — only clinician-approved phrases are offered here, and none match yet.'
      : "I don't have a confident suggestion.",
    alternatives: REFUSAL_ALTERNATIVES,
    ...stakes,
  };
}

/** Same normalization retrieval de-dupes with — used to merge PCG + LLM cards. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/^(i want to|i want|i would like to|id like to|please|can you|could you)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Constrained cards straight from the ranked retrieval shortlist. */
function constrainedCards(kept: Scored[], max: number): SuggestionCandidate[] {
  const cards: SuggestionCandidate[] = [];
  for (const scored of kept.slice(0, max)) {
    const candidate = buildCandidate({
      sourceItems: [toSourceItem(scored.ranked)],
      mode: scored.ranked.candidate.mode,
      confidence: scored.confidence,
      edgeIds: [],
    });
    if (!candidate) continue;
    assertGrounded(candidate);
    cards.push(candidate);
  }
  return cards;
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

  // High-stakes is FORCED (caller flag) or DETECTED from the text itself (SPEC
  // §7.3 — medical/legal/financial/consent topics never get free generation).
  const detection = detectHighStakes(ctx.partialText);
  if (detection.highStakes && !ctx.highStakes) {
    ctx = { ...ctx, highStakes: true };
  }
  const stakes: StakesInfo = ctx.highStakes
    ? { highStakes: true, highStakesCategory: detection.category }
    : {};

  // Retrieve + rank the PCG shortlist. These are the user's OWN phrases.
  const retrieved = await retrieve(exec, ctx, embedder, { topK: 12 });
  const ranked = rank(retrieved, ctx, weights, nowEpoch, retrieved.length);
  const kept = ranked.map(scoreConfidence).filter((s) => s.gate !== 'refuse');
  const pcgCards = constrainedCards(kept, maxCards);

  // How strongly does the best PCG phrase actually match this input? Semantic or
  // keyword signal decides whether the graph leads or the LLM leads the list.
  const top = kept[0]?.ranked.candidate.scores;
  const strongMatch = Boolean(top && (top.semantic >= 0.6 || top.keyword >= 0.5));

  // LLM cards fill the rest (never for high-stakes). A failure just means an
  // all-PCG list — generation is additive, not load-bearing.
  let llmCards: SuggestionCandidate[] = [];
  if (options.groqApiKey && !ctx.highStakes) {
    try {
      llmCards = await generateSuggestions(ctx, retrieved, {
        apiKey: options.groqApiKey,
        model: options.llmModel,
        count: maxCards,
        fetchImpl: options.fetchImpl,
      });
    } catch {
      /* fall through to the PCG-only list */
    }
  }

  // Blend: strong graph match → the user's own phrases lead; otherwise the fluent
  // LLM sentences lead and the best PCG phrases still appear. De-dupe on the same
  // normalization retrieval uses, so "call Sarah" and "I want to call Sarah"
  // never both show.
  const lead = strongMatch ? pcgCards : llmCards;
  const tail = strongMatch ? llmCards : pcgCards;
  const seen = new Set<string>();
  const candidates: SuggestionCandidate[] = [];
  const leadQuota = Math.min(lead.length, 3);
  for (const c of lead.slice(0, leadQuota)) {
    const key = normalize(c.text);
    if (key && !seen.has(key)) {
      seen.add(key);
      candidates.push(c);
    }
  }
  for (const c of [...tail, ...lead.slice(leadQuota)]) {
    if (candidates.length >= maxCards) break;
    const key = normalize(c.text);
    if (key && !seen.has(key)) {
      seen.add(key);
      candidates.push(c);
    }
  }

  return candidates.length > 0 ? { kind: 'candidates', candidates, ...stakes } : refusal(stakes);
}
