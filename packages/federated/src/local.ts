/**
 * The on-clinic computation (SPEC §F). This runs INSIDE the clinic on its patients'
 * feedback and produces only a weight delta. The raw feedback (derived from patient
 * PCGs) never leaves — only the clipped, noised, masked delta does.
 */

export interface FeedbackSample {
  /** The ranker feature vector for a shown suggestion. */
  features: number[];
  /** 1 = accepted, 0 = rejected. */
  label: 0 | 1;
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/** Mean logistic loss of `weights` over a batch (for convergence checks). */
export function logisticLoss(weights: readonly number[], batch: readonly FeedbackSample[]): number {
  if (batch.length === 0) return 0;
  let loss = 0;
  for (const s of batch) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(dot(weights, s.features))));
    loss += -(s.label * Math.log(p) + (1 - s.label) * Math.log(1 - p));
  }
  return loss / batch.length;
}

/**
 * One local gradient step: Δw = −lr · mean over the batch of (pred − label)·features.
 * `pinnedIndices` are held fixed (Δ = 0) — the Safety feature (learning rate 0) is a
 * hard constraint that must survive federation exactly as in the single-user ranker.
 */
export function computeLocalDelta(
  weights: readonly number[],
  batch: readonly FeedbackSample[],
  lr: number,
  pinnedIndices: readonly number[] = [],
): number[] {
  const dim = weights.length;
  const grad = new Array<number>(dim).fill(0);
  for (const s of batch) {
    const err = sigmoid(dot(weights, s.features)) - s.label;
    for (let i = 0; i < dim; i++) grad[i] = grad[i]! + err * s.features[i]!;
  }
  const n = Math.max(1, batch.length);
  const delta = grad.map((g) => -lr * (g / n));
  for (const idx of pinnedIndices) delta[idx] = 0;
  return delta;
}
