/**
 * The Hard Rule test (SPEC §8). If any of these fail, the structural guarantee
 * that user-facing suggestions come only from PCG items has been broken — that is
 * a safety incident, and the build must go red.
 */

import {
  buildCandidate,
  assertGrounded,
  gateFor,
  applyHighStakesFilter,
  HardRuleViolation,
  type PcgSourceItem,
} from '../index';
import { PrivacyTier } from '@halfsaid/shared-types';

const yoursItem: PcgSourceItem = {
  nodeId: 'node-1',
  text: 'call Sarah',
  sourceTag: 'yours',
};

describe('the Hard Rule: candidates come only from PCG items', () => {
  it('builds a candidate from a PCG item and carries its provenance', () => {
    const candidate = buildCandidate({
      sourceItems: [yoursItem],
      mode: 'full_utterance',
      confidence: 0.9,
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.text).toBe('call Sarah');
    expect(candidate!.provenance.nodeIds).toEqual(['node-1']);
    expect(candidate!.gate).toBe('ship');
  });

  it('refuses to build from zero PCG items (no free-form path exists)', () => {
    expect(() =>
      buildCandidate({ sourceItems: [], mode: 'full_utterance', confidence: 0.9 }),
    ).toThrow(HardRuleViolation);
  });

  it('rejects a PCG item with empty text', () => {
    expect(() =>
      buildCandidate({
        sourceItems: [{ nodeId: 'n', text: '   ', sourceTag: 'yours' }],
        mode: 'phrase',
        confidence: 0.9,
      }),
    ).toThrow(HardRuleViolation);
  });

  it('rejects a PCG item with no node id (provenance anchor missing)', () => {
    expect(() =>
      buildCandidate({
        sourceItems: [{ nodeId: '', text: 'hi', sourceTag: 'yours' }],
        mode: 'phrase',
        confidence: 0.9,
      }),
    ).toThrow(HardRuleViolation);
  });

  it('every emitted candidate passes the grounding assertion', () => {
    const candidate = buildCandidate({
      sourceItems: [yoursItem],
      mode: 'full_utterance',
      confidence: 0.85,
    });
    expect(() => assertGrounded(candidate!)).not.toThrow();
  });
});

describe('confidence gates (SPEC §7.2)', () => {
  it('maps confidence to the right gate', () => {
    expect(gateFor(0.85)).toBe('ship');
    expect(gateFor(0.6)).toBe('sandbox');
    expect(gateFor(0.3)).toBe('refuse');
  });

  it('returns null (refusal path) below the sandbox floor instead of a candidate', () => {
    const candidate = buildCandidate({
      sourceItems: [yoursItem],
      mode: 'full_utterance',
      confidence: 0.3,
    });
    expect(candidate).toBeNull();
  });

  it('marks 0.5–0.8 candidates as sandbox', () => {
    const candidate = buildCandidate({
      sourceItems: [yoursItem],
      mode: 'full_utterance',
      confidence: 0.65,
    });
    expect(candidate!.gate).toBe('sandbox');
  });
});

describe('composition uses the weakest source tag', () => {
  it('a card composed from yours + therapist is tagged yours (never over-claims)', () => {
    const candidate = buildCandidate({
      sourceItems: [
        { nodeId: 'a', text: 'I want to', sourceTag: 'therapist-approved' },
        { nodeId: 'b', text: 'go to the garden', sourceTag: 'yours' },
      ],
      mode: 'full_utterance',
      confidence: 0.9,
    });
    expect(candidate!.text).toBe('I want to go to the garden');
    expect(candidate!.sourceTag).toBe('yours');
    expect(candidate!.provenance.nodeIds).toEqual(['a', 'b']);
  });
});

describe('high-stakes hard-block seam (SPEC §7.3, forced flag)', () => {
  const items: PcgSourceItem[] = [
    { nodeId: 'u', text: 'user thing', sourceTag: 'yours' },
    { nodeId: 'c', text: 'clinician thing', sourceTag: 'therapist-approved' },
  ];
  const tierOf = (item: PcgSourceItem) =>
    item.sourceTag === 'therapist-approved' ? PrivacyTier.ClinicianPlus : PrivacyTier.UserOnly;

  it('passes items through when not high-stakes', () => {
    const out = applyHighStakesFilter(items, { forced: false }, tierOf);
    expect(out).toHaveLength(2);
  });

  it('restricts to Tier 3 (clinician-approved) items when forced', () => {
    const out = applyHighStakesFilter(items, { forced: true }, tierOf);
    expect(out).toHaveLength(1);
    expect(out[0]!.nodeId).toBe('c');
  });
});
