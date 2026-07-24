/**
 * Adaptive ranker (SPEC §5.2, PRD §17.2). Online logistic regression with per-user
 * weights over six feature categories. Orders survivors by predicted acceptance and
 * greedily promotes variety.
 *
 * CRITICAL: the Safety feature has learning rate 0 — it is a HARD CONSTRAINT, never
 * a learned weight. updateWeights must never move it. A test asserts this.
 */

import { PrivacyTier } from '@halfsaid/shared-types';
import type { RetrievedCandidate, SuggestionContext } from './types';

export interface FeatureVector {
  relevance: number;
  personalVoice: number;
  safety: number;
  recency: number;
  variety: number;
  contextMatch: number;
}

export type RankerWeights = FeatureVector;

/** Initial weights (PRD §17.2). */
export const INITIAL_WEIGHTS: RankerWeights = {
  relevance: 0.35,
  personalVoice: 0.2,
  safety: 0.15,
  recency: 0.15,
  variety: 0.1,
  contextMatch: 0.05,
};

/** Per-feature learning rates (PRD §17.2). Safety is 0 — a hard constraint. */
export const LEARNING_RATES: RankerWeights = {
  relevance: 0.01,
  personalVoice: 0.005,
  safety: 0,
  recency: 0.008,
  variety: 0.005,
  contextMatch: 0.003,
};

const DAY = 86_400;

/** Safety feature value from the PCG source tier (validated > user > cold). */
export function safetyFeature(tier: PrivacyTier): number {
  if (tier >= PrivacyTier.ClinicianPlus) return 1.0;
  if (tier === PrivacyTier.FamilyPlus) return 0.85;
  if (tier === PrivacyTier.UserOnly) return 0.7;
  return 0.5;
}

function recencyFeature(eventEpoch: number, nowEpoch: number): number {
  const ageDays = Math.max(0, (nowEpoch - eventEpoch) / DAY);
  return Math.exp(-ageDays / 30); // 30-day decay
}

/** Build the (variety-free) feature vector for a candidate. */
export function features(
  c: RetrievedCandidate,
  ctx: SuggestionContext,
  nowEpoch: number,
): FeatureVector {
  return {
    relevance: clamp01(0.6 * c.scores.semantic + 0.4 * c.scores.keyword),
    personalVoice: clamp01(c.salience),
    safety: safetyFeature(c.privacyTier),
    recency: recencyFeature(c.eventEpoch, nowEpoch),
    variety: 1, // filled during greedy selection
    contextMatch: clamp01(c.scores.subgraph),
  };
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Predicted acceptance probability (logistic). */
export function score(w: RankerWeights, f: FeatureVector): number {
  const z =
    w.relevance * f.relevance +
    w.personalVoice * f.personalVoice +
    w.safety * f.safety +
    w.recency * f.recency +
    w.variety * f.variety +
    w.contextMatch * f.contextMatch;
  return sigmoid(z);
}

/**
 * Online gradient update from one accept(1)/reject(0) event. The Safety weight is
 * pinned (learning rate 0) so it can never drift into a learned value.
 */
export function updateWeights(w: RankerWeights, f: FeatureVector, label: 0 | 1): RankerWeights {
  const pred = score(w, f);
  const err = label - pred;
  return {
    relevance: w.relevance + LEARNING_RATES.relevance * err * f.relevance,
    personalVoice: w.personalVoice + LEARNING_RATES.personalVoice * err * f.personalVoice,
    safety: w.safety, // hard constraint — learning rate 0
    recency: w.recency + LEARNING_RATES.recency * err * f.recency,
    variety: w.variety + LEARNING_RATES.variety * err * f.variety,
    contextMatch: w.contextMatch + LEARNING_RATES.contextMatch * err * f.contextMatch,
  };
}

export interface RankedCandidate {
  candidate: RetrievedCandidate;
  rankScore: number;
  features: FeatureVector;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Final ranking (SPEC §5.1 step 6): order by predicted acceptance, greedily
 * promoting variety (anti-mirroring, SPEC §5.4) — each pick's variety feature is
 * 1 − max token-overlap with everything already chosen.
 */
export function rank(
  candidates: RetrievedCandidate[],
  ctx: SuggestionContext,
  weights: RankerWeights = INITIAL_WEIGHTS,
  nowEpoch: number,
  topN = 5,
): RankedCandidate[] {
  const remaining = candidates.map((c) => ({
    c,
    f: features(c, ctx, nowEpoch),
    toks: tokenSet(c.content),
  }));
  const chosen: RankedCandidate[] = [];
  const chosenToks: Set<string>[] = [];

  while (remaining.length > 0 && chosen.length < topN) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    let bestFeatures: FeatureVector | null = null;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i]!;
      const variety =
        chosenToks.length === 0 ? 1 : 1 - Math.max(...chosenToks.map((s) => jaccard(r.toks, s)));
      const f = { ...r.f, variety };
      const s = score(weights, f);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
        bestFeatures = f;
      }
    }
    const picked = remaining.splice(bestIdx, 1)[0]!;
    chosen.push({ candidate: picked.c, rankScore: bestScore, features: bestFeatures! });
    chosenToks.push(picked.toks);
  }
  return chosen;
}
