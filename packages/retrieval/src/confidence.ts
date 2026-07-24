/**
 * Confidence scoring (SPEC §7.1, PRD §22.2). A calibrated 0–1 score from five
 * inputs, combined via a weighted geometric mean. The gate (ship/sandbox/refuse)
 * comes from @halfsaid/safety-policy.
 *
 * D2 (SPEC §11): MVP approximates the PRD's Platt/isotonic calibration with a fixed
 * weighted geometric mean, and floors each input so a single weak signal (e.g. no
 * context match) doesn't collapse the score to 0 and refuse everything.
 */

import { gateFor, type PcgSourceItem } from '@halfsaid/safety-policy';
import { PrivacyTier, type ConfidenceGate } from '@halfsaid/shared-types';
import { safetyFeature } from './ranker';
import type { RankedCandidate } from './ranker';

export interface ConfidenceInputs {
  /** Retrieval score of the top PCG item (0–1). */
  retrieval: number;
  /** Constrained-decoding log-prob proxy (0–1); high for grounded items. */
  generationLogprob: number;
  /** PCG source tier weight (0.5–1.0). */
  sourceTier: number;
  /** Context-vector match (0–1). */
  contextMatch: number;
  /** Historical accept rate for similar suggestions (0–1). */
  acceptRate: number;
}

/** Exponents for the weighted geometric mean (sum to 1). */
const WEIGHTS: ConfidenceInputs = {
  retrieval: 0.25,
  generationLogprob: 0.15,
  sourceTier: 0.25,
  contextMatch: 0.15,
  acceptRate: 0.2,
};

/** Each input is floored so one weak signal can't zero the geometric mean (D2). */
const FLOOR = 0.4;

export function confidenceFrom(inputs: ConfidenceInputs): number {
  const terms: Array<[number, number]> = [
    [inputs.retrieval, WEIGHTS.retrieval],
    [inputs.generationLogprob, WEIGHTS.generationLogprob],
    [inputs.sourceTier, WEIGHTS.sourceTier],
    [inputs.contextMatch, WEIGHTS.contextMatch],
    [inputs.acceptRate, WEIGHTS.acceptRate],
  ];
  let logSum = 0;
  for (const [value, weight] of terms) {
    const floored = Math.min(1, Math.max(FLOOR, value));
    logSum += weight * Math.log(floored);
  }
  return Math.exp(logSum);
}

/** For a constrained candidate, the generation log-prob proxy is high and fixed. */
const CONSTRAINED_LOGPROB = 0.9;

/** Build the confidence inputs for a ranked candidate. */
export function inputsForRanked(ranked: RankedCandidate): ConfidenceInputs {
  const c = ranked.candidate;
  const retrieval = Math.max(c.scores.semantic, c.scores.keyword, c.scores.subgraph);
  return {
    retrieval,
    generationLogprob: CONSTRAINED_LOGPROB,
    sourceTier: safetyFeature(c.privacyTier as PrivacyTier),
    contextMatch: Math.max(c.scores.subgraph, ranked.features.contextMatch),
    // No accept/reject history yet at demo time; use the ranker's predicted accept.
    acceptRate: ranked.rankScore,
  };
}

export interface Scored {
  ranked: RankedCandidate;
  confidence: number;
  gate: ConfidenceGate;
}

/** Score + gate a ranked candidate (SPEC §7.2). */
export function scoreConfidence(ranked: RankedCandidate): Scored {
  const confidence = confidenceFrom(inputsForRanked(ranked));
  return { ranked, confidence, gate: gateFor(confidence) };
}

/** Adapt a retrieved candidate into the PCG source item the safety builder needs. */
export function toSourceItem(ranked: RankedCandidate): PcgSourceItem {
  return {
    nodeId: ranked.candidate.nodeId,
    text: ranked.candidate.content,
    sourceTag: ranked.candidate.sourceTag,
  };
}
