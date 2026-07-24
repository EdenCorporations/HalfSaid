/**
 * Federated round orchestration (SPEC §F). Ties together: on-clinic local update →
 * clip → DP noise → secure-aggregation mask → aggregate → apply. The Safety weight is
 * pinned through the whole process (learning rate 0 is a hard constraint, SPEC §5.2).
 */

import type { RankerWeights } from '@halfsaid/retrieval';
import { addGaussianNoise, clipL2, PrivacyLedger, type DpParams } from './dp';
import { computeLocalDelta, type FeedbackSample } from './local';
import { aggregateMasked, maskDelta, pairwiseMask } from './secure-agg';
import { seedFrom } from './prng';

/** Ranker model layout: [relevance, personalVoice, safety, recency, variety, contextMatch]. */
export const RANKER_DIM = 6;
export const SAFETY_INDEX = 2;

export function weightsToVector(w: RankerWeights): number[] {
  return [w.relevance, w.personalVoice, w.safety, w.recency, w.variety, w.contextMatch];
}
export function vectorToWeights(v: readonly number[]): RankerWeights {
  return {
    relevance: v[0]!,
    personalVoice: v[1]!,
    safety: v[2]!,
    recency: v[3]!,
    variety: v[4]!,
    contextMatch: v[5]!,
  };
}

/** A clinic's private inputs — NEVER transmitted. */
export interface ClinicData {
  clinicId: string;
  feedback: FeedbackSample[];
}

/**
 * The ONLY thing that leaves a clinic. It carries a masked+noised delta and a sample
 * count — no features, no utterances, no PCG. Structurally cannot hold raw data.
 */
export interface ClinicUpdate {
  clinicId: string;
  maskedDelta: number[];
  sampleCount: number;
}

export interface RoundConfig {
  lr: number;
  dp: DpParams;
  roundSeed: string | number;
}

/**
 * Runs entirely on a clinic: local step → clip → DP noise → pairwise mask. Returns the
 * sealed update to transmit. `clinicIds` is the roster participating this round (public).
 */
export function clinicLocalStep(
  globalWeights: readonly number[],
  clinic: ClinicData,
  clinicIds: readonly string[],
  cfg: RoundConfig,
): ClinicUpdate {
  let delta = computeLocalDelta(globalWeights, clinic.feedback, cfg.lr, [SAFETY_INDEX]);
  delta = clipL2(delta, cfg.dp.clipNorm);
  delta = addGaussianNoise(delta, cfg.dp, seedFrom(cfg.roundSeed, clinic.clinicId, 'noise'));
  const mask = pairwiseMask(clinic.clinicId, clinicIds, globalWeights.length, cfg.roundSeed);
  return {
    clinicId: clinic.clinicId,
    maskedDelta: maskDelta(delta, mask),
    sampleCount: clinic.feedback.length,
  };
}

/** Server side: aggregate masked updates and apply (Safety pinned). */
export function aggregateRound(
  globalWeights: readonly number[],
  updates: ReadonlyArray<Pick<ClinicUpdate, 'maskedDelta'>>,
): number[] {
  const meanDelta = aggregateMasked(updates.map((u) => u.maskedDelta));
  const next = globalWeights.map((x, i) => x + (meanDelta[i] ?? 0));
  next[SAFETY_INDEX] = globalWeights[SAFETY_INDEX]!; // hard constraint survives federation
  return next;
}

export interface RoundResult {
  weights: number[];
  updates: ClinicUpdate[];
  epsilonSpent: number;
  clinics: number;
}

/**
 * A full simulated round (each clinic computes locally; only masked updates are
 * aggregated). Charges the privacy ledger. In production the local steps run on the
 * clinics and only `updates` cross the wire.
 */
export function runFederatedRound(
  globalWeights: readonly number[],
  clinics: ClinicData[],
  cfg: RoundConfig,
  ledger?: PrivacyLedger,
): RoundResult {
  const clinicIds = clinics.map((c) => c.clinicId);
  const updates = clinics.map((c) => clinicLocalStep(globalWeights, c, clinicIds, cfg));
  const weights = aggregateRound(globalWeights, updates);
  ledger?.charge(cfg.dp.epsilon, cfg.dp.delta);
  return { weights, updates, epsilonSpent: cfg.dp.epsilon, clinics: clinics.length };
}
