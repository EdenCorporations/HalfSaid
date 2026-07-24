/**
 * DP + secure-aggregation guarantees (SPEC §F). The headline property: the aggregator
 * recovers the MEAN of the true updates but never sees any individual update — the
 * pairwise masks cancel exactly.
 */

import {
  clipL2,
  l2norm,
  gaussianSigma,
  addGaussianNoise,
  PrivacyLedger,
  pairwiseMask,
  maskDelta,
  aggregateMasked,
} from '../index';

describe('secure aggregation: masks cancel, individuals stay hidden', () => {
  const clinics = ['brooks', 'kessler', 'shirley'];
  const raw: Record<string, number[]> = {
    brooks: [1, 2, 3],
    kessler: [4, 5, 6],
    shirley: [-1, -1, -1],
  };

  it('mean(masked) === mean(raw)', () => {
    const masked = clinics.map((c) => maskDelta(raw[c]!, pairwiseMask(c, clinics, 3, 'round-1')));
    const agg = aggregateMasked(masked);
    const rawMean = [(1 + 4 - 1) / 3, (2 + 5 - 1) / 3, (3 + 6 - 1) / 3];
    agg.forEach((x, i) => expect(x).toBeCloseTo(rawMean[i]!, 9));
  });

  it('each transmitted (masked) update differs from the raw update', () => {
    const masked = maskDelta(raw.brooks!, pairwiseMask('brooks', clinics, 3, 'round-1'));
    expect(masked).not.toEqual(raw.brooks);
  });

  it('a clinic pair uses equal-and-opposite shared masks', () => {
    // With only two clinics, their masks are exact negatives → sum is the raw sum.
    const two = ['a', 'b'];
    const mA = pairwiseMask('a', two, 4, 'r');
    const mB = pairwiseMask('b', two, 4, 'r');
    mA.forEach((x, i) => expect(x).toBeCloseTo(-mB[i]!, 12));
  });
});

describe('differential privacy: clipping + Gaussian mechanism', () => {
  it('clips to the L2 sensitivity bound', () => {
    expect(l2norm(clipL2([3, 4], 5))).toBeCloseTo(5, 9); // already at 5 → unchanged
    expect(l2norm(clipL2([6, 8], 5))).toBeCloseTo(5, 9); // norm 10 → scaled to 5
  });

  it('smaller epsilon ⇒ more noise', () => {
    const strict = gaussianSigma({ clipNorm: 1, epsilon: 0.5, delta: 1e-5 });
    const loose = gaussianSigma({ clipNorm: 1, epsilon: 4, delta: 1e-5 });
    expect(strict).toBeGreaterThan(loose);
  });

  it('noise is deterministic per seed and actually perturbs', () => {
    const p = { clipNorm: 1, epsilon: 1, delta: 1e-5 };
    const a = addGaussianNoise([0, 0, 0], p, 123);
    const b = addGaussianNoise([0, 0, 0], p, 123);
    expect(a).toEqual(b);
    expect(a).not.toEqual([0, 0, 0]);
  });

  it('the ledger tracks and exhausts the budget', () => {
    const ledger = new PrivacyLedger(1.0, 1e-4);
    ledger.charge(0.4, 1e-5);
    expect(ledger.remainingEpsilon).toBeCloseTo(0.6, 9);
    expect(ledger.exhausted).toBe(false);
    ledger.charge(0.7, 1e-5);
    expect(ledger.exhausted).toBe(true);
  });
});
