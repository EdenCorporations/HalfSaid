/**
 * Federated round tests (SPEC §F): only masked deltas leave a clinic, the Safety
 * weight stays pinned through federation, and clinics collaboratively improve the
 * shared model without sharing data.
 */

import {
  RANKER_DIM,
  SAFETY_INDEX,
  computeLocalDelta,
  clinicLocalStep,
  runFederatedRound,
  logisticLoss,
  mulberry32,
  PrivacyLedger,
  type ClinicData,
  type FeedbackSample,
  type RoundConfig,
} from '../index';

const cfg: RoundConfig = {
  lr: 0.5,
  dp: { clipNorm: 1, epsilon: 20, delta: 1e-5 },
  roundSeed: 'round-1',
};

/** Synthetic feedback: label follows a "relevance matters" true model. */
function makeBatch(seed: number, n: number): FeedbackSample[] {
  const rng = mulberry32(seed);
  const trueW = [2.5, 0, 0, 0, 0, 0];
  const out: FeedbackSample[] = [];
  for (let i = 0; i < n; i++) {
    const features = Array.from({ length: RANKER_DIM }, () => rng() * 2 - 1);
    const p = 1 / (1 + Math.exp(-features.reduce((s, x, k) => s + x * trueW[k]!, 0)));
    out.push({ features, label: p > 0.5 ? 1 : 0 });
  }
  return out;
}

describe('on-clinic local step', () => {
  it('pins the Safety feature (its delta is always 0)', () => {
    const delta = computeLocalDelta([0, 0, 0, 0, 0, 0], makeBatch(1, 20), 0.5, [SAFETY_INDEX]);
    expect(delta[SAFETY_INDEX]).toBe(0);
  });

  it('transmits ONLY a masked delta — no features, no raw data', () => {
    const update = clinicLocalStep(
      [0, 0, 0, 0, 0, 0],
      { clinicId: 'c', feedback: makeBatch(2, 20) },
      ['c', 'd'],
      cfg,
    );
    expect(Object.keys(update).sort()).toEqual(['clinicId', 'maskedDelta', 'sampleCount']);
    expect(JSON.stringify(update)).not.toContain('features');
    expect(JSON.stringify(update)).not.toContain('label');
  });
});

describe('federated round', () => {
  const clinics: ClinicData[] = [
    { clinicId: 'brooks', feedback: makeBatch(10, 40) },
    { clinicId: 'kessler', feedback: makeBatch(20, 40) },
    { clinicId: 'shirley', feedback: makeBatch(30, 40) },
  ];

  it('keeps the Safety weight fixed through federation', () => {
    const global = [0, 0, 0.15, 0, 0, 0];
    const { weights } = runFederatedRound(global, clinics, cfg);
    expect(weights[SAFETY_INDEX]).toBe(0.15);
  });

  it('charges the privacy ledger per round', () => {
    const ledger = new PrivacyLedger(2.0, 1e-4);
    runFederatedRound([0, 0, 0, 0, 0, 0], clinics, cfg, ledger);
    expect(ledger.spentEpsilon).toBeCloseTo(cfg.dp.epsilon, 9);
  });

  it('collaboratively improves the shared model (loss falls) without sharing data', () => {
    // A held-out batch the "server" never trains on — just to measure quality.
    const test = makeBatch(999, 200);
    let global = new Array(RANKER_DIM).fill(0) as number[];
    const before = logisticLoss(global, test);
    for (let r = 0; r < 20; r++) {
      global = runFederatedRound(global, clinics, { ...cfg, roundSeed: `round-${r}` }).weights;
    }
    const after = logisticLoss(global, test);
    expect(after).toBeLessThan(before); // learned across clinics
    expect(global[0]!).toBeGreaterThan(0); // moved toward the true "relevance" signal
  });
});
