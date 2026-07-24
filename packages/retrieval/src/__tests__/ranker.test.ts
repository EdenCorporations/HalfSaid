/**
 * Adaptive ranker + confidence tests (SPEC §5.2, §7). The load-bearing assertion:
 * the Safety feature's weight never moves under online learning (learning rate 0).
 */

import { PrivacyTier } from '@halfsaid/shared-types';
import {
  INITIAL_WEIGHTS,
  updateWeights,
  features,
  score,
  rank,
  safetyFeature,
  confidenceFrom,
  scoreConfidence,
  type RetrievedCandidate,
  type FeatureVector,
} from '../index';

const NOW = 1_780_000_000; // fixed epoch for deterministic recency

function candidate(over: Partial<RetrievedCandidate> = {}): RetrievedCandidate {
  return {
    nodeId: over.nodeId ?? 'n1',
    content: over.content ?? 'call Sarah',
    mode: 'full_utterance',
    privacyTier: over.privacyTier ?? PrivacyTier.FamilyPlus,
    sourceTag: 'family-validated',
    salience: over.salience ?? 0.9,
    eventEpoch: over.eventEpoch ?? NOW - 86_400,
    scores: over.scores ?? { semantic: 0.5, keyword: 1, subgraph: 0, prior: 0.9 },
    mergedFrom: over.mergedFrom ?? ['n1', 'n2'],
  };
}

describe('adaptive ranker', () => {
  const ctx = { userId: 'u', partialText: 'I want to', intent: 'request' };

  it('the Safety weight never drifts (learning rate 0)', () => {
    let w = { ...INITIAL_WEIGHTS };
    const f: FeatureVector = features(candidate(), ctx, NOW);
    // Hammer it with alternating accept/reject events.
    for (let i = 0; i < 500; i++) {
      w = updateWeights(w, f, (i % 2) as 0 | 1);
    }
    expect(w.safety).toBe(INITIAL_WEIGHTS.safety);
    // A learned weight (e.g. relevance) should have moved.
    expect(w.relevance).not.toBe(INITIAL_WEIGHTS.relevance);
  });

  it('learns toward accepted candidates (predicted score rises)', () => {
    let w = { ...INITIAL_WEIGHTS };
    const f = features(candidate(), ctx, NOW);
    const before = score(w, f);
    for (let i = 0; i < 50; i++) w = updateWeights(w, f, 1);
    expect(score(w, f)).toBeGreaterThan(before);
  });

  it('safetyFeature ranks validated > user > cold', () => {
    expect(safetyFeature(PrivacyTier.ClinicianPlus)).toBeGreaterThan(
      safetyFeature(PrivacyTier.FamilyPlus),
    );
    expect(safetyFeature(PrivacyTier.FamilyPlus)).toBeGreaterThan(
      safetyFeature(PrivacyTier.UserOnly),
    );
  });

  it('promotes variety: does not return two near-identical phrasings', () => {
    const cands = [
      candidate({ nodeId: 'a', content: 'call Sarah', salience: 0.97 }),
      candidate({ nodeId: 'b', content: 'call Sarah now', salience: 0.96 }),
      candidate({
        nodeId: 'c',
        content: 'go to the garden',
        salience: 0.9,
        privacyTier: PrivacyTier.UserOnly,
      }),
    ];
    const ranked = rank(cands, ctx, INITIAL_WEIGHTS, NOW, 2);
    const texts = ranked.map((r) => r.candidate.content);
    expect(texts).toContain('call Sarah');
    expect(texts).toContain('go to the garden'); // variety beat the near-duplicate
  });
});

describe('confidence scoring + gates (SPEC §7)', () => {
  it('a floored weak signal does not collapse confidence to refuse', () => {
    const c = confidenceFrom({
      retrieval: 0, // weak
      generationLogprob: 0.9,
      sourceTier: 0.85,
      contextMatch: 0, // weak
      acceptRate: 0.7,
    });
    expect(c).toBeGreaterThan(0.5); // not auto-refused
  });

  it('a strong, validated candidate ships (>= 0.8)', () => {
    const ranked = {
      candidate: candidate({ privacyTier: PrivacyTier.ClinicianPlus }),
      rankScore: 0.9,
      features: features(
        candidate({ privacyTier: PrivacyTier.ClinicianPlus }),
        { userId: 'u', partialText: 'x' },
        NOW,
      ),
    };
    const { confidence, gate } = scoreConfidence(ranked);
    expect(confidence).toBeGreaterThanOrEqual(0.8);
    expect(gate).toBe('ship');
  });
});
