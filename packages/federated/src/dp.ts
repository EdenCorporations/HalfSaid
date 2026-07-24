/**
 * Differential privacy for the local model update (SPEC §F). Each clinic clips its
 * update to a bounded L2 norm (the sensitivity), then adds calibrated Gaussian noise
 * — the (ε, δ) Gaussian mechanism — before it ever leaves the clinic. A ledger tracks
 * the privacy budget spent across rounds.
 */

import { gaussian, mulberry32 } from './prng';

export function l2norm(v: readonly number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

/** Clip a vector to L2 norm ≤ C. This bounds the per-clinic sensitivity. */
export function clipL2(v: readonly number[], clipNorm: number): number[] {
  const n = l2norm(v);
  if (n <= clipNorm || n === 0) return [...v];
  const scale = clipNorm / n;
  return v.map((x) => x * scale);
}

export interface DpParams {
  /** L2 clip bound = sensitivity C. */
  clipNorm: number;
  /** Privacy loss ε (smaller = more private, more noise). */
  epsilon: number;
  /** Failure probability δ. */
  delta: number;
}

/** Gaussian-mechanism noise scale σ for (ε, δ)-DP at sensitivity C. */
export function gaussianSigma(p: DpParams): number {
  return (p.clipNorm * Math.sqrt(2 * Math.log(1.25 / p.delta))) / p.epsilon;
}

/** Add i.i.d. Gaussian noise (σ from the mechanism) to each component. Deterministic per seed. */
export function addGaussianNoise(v: readonly number[], p: DpParams, seed: number): number[] {
  const sigma = gaussianSigma(p);
  const rng = mulberry32(seed);
  return v.map((x) => x + sigma * gaussian(rng));
}

/** Tracks the (ε, δ) budget spent under basic (sequential) composition. */
export class PrivacyLedger {
  spentEpsilon = 0;
  spentDelta = 0;
  constructor(
    readonly epsilonBudget: number,
    readonly deltaBudget: number,
  ) {}

  charge(epsilon: number, delta: number): void {
    this.spentEpsilon += epsilon;
    this.spentDelta += delta;
  }
  get remainingEpsilon(): number {
    return this.epsilonBudget - this.spentEpsilon;
  }
  get exhausted(): boolean {
    return this.spentEpsilon > this.epsilonBudget + 1e-9;
  }
}
