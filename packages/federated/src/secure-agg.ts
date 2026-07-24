/**
 * Secure aggregation (SPEC §F). Every clinic adds pairwise masks to its (already
 * noised) update so the aggregator sees only masked values — never any individual
 * clinic's contribution. For each pair of clinics {a, b} a shared pseudo-random
 * vector is derived from a seed both can compute; the lexicographically-smaller
 * clinic ADDS it, the larger SUBTRACTS it. Across the sum every pair cancels, so the
 * aggregator recovers exactly the sum of the true updates and nothing else.
 */

import { randomVector, seedFrom } from './prng';

/** The additive mask clinic `clinicId` applies this round. */
export function pairwiseMask(
  clinicId: string,
  clinicIds: readonly string[],
  dim: number,
  roundSeed: string | number,
): number[] {
  const mask = new Array<number>(dim).fill(0);
  for (const other of clinicIds) {
    if (other === clinicId) continue;
    const [a, b] = [clinicId, other].sort();
    const shared = randomVector(seedFrom(roundSeed, a!, b!), dim);
    const sign = clinicId === a ? 1 : -1;
    for (let k = 0; k < dim; k++) mask[k] = mask[k]! + sign * shared[k]!;
  }
  return mask;
}

export function maskDelta(delta: readonly number[], mask: readonly number[]): number[] {
  return delta.map((x, i) => x + mask[i]!);
}

/**
 * Aggregate masked updates into the mean true update. Because the pairwise masks sum
 * to zero, `mean(masked) === mean(raw)` — the server never learns any single update.
 */
export function aggregateMasked(maskedDeltas: ReadonlyArray<readonly number[]>): number[] {
  if (maskedDeltas.length === 0) return [];
  const dim = maskedDeltas[0]!.length;
  const sum = new Array<number>(dim).fill(0);
  for (const md of maskedDeltas) {
    for (let i = 0; i < dim; i++) sum[i] = sum[i]! + md[i]!;
  }
  return sum.map((x) => x / maskedDeltas.length);
}
