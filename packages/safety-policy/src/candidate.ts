/**
 * The Hard Rule, made structural (SPEC §0 Rule 1, §8).
 *
 * User-facing utterances are constrained-decoded from PCG items only. This module
 * is the ONLY sanctioned way to construct a `SuggestionCandidate`, and it accepts
 * PCG items — never a free-form string. There is therefore no code path by which a
 * raw model completion can become a user-facing candidate. A test in
 * `src/__tests__/candidate.test.ts` fails the build if that guarantee is broken.
 *
 * Phase 1 implements the structural seam. The constrained-composition grammar and
 * the retrieval/confidence pipeline that feed it arrive in Phase 3.
 */

import type {
  ConfidenceGate,
  Provenance,
  SourceTag,
  SuggestionCandidate,
  SuggestionMode,
} from '@halfsaid/shared-types';

/** Thrown when an attempt is made to violate the Hard Rule. */
export class HardRuleViolation extends Error {
  constructor(message: string) {
    super(`[HardRule] ${message}`);
    this.name = 'HardRuleViolation';
  }
}

/**
 * A single PCG-sourced item eligible to become (part of) a suggestion. Its `text`
 * is user-authored, family-validated, or therapist-approved — it originates in the
 * PCG, not from a model. `nodeId` is the provenance anchor.
 */
export interface PcgSourceItem {
  readonly nodeId: string;
  readonly text: string;
  readonly sourceTag: SourceTag;
}

/** Confidence thresholds (SPEC §7.2). */
export const CONFIDENCE = {
  /** ≥ this ships as a standard card. */
  SHIP: 0.8,
  /** ≥ this (and < SHIP) is sandboxed; below this is refused. */
  SANDBOX_FLOOR: 0.5,
} as const;

/** Map a calibrated confidence to its gate (SPEC §7.2). */
export function gateFor(confidence: number): ConfidenceGate {
  if (confidence >= CONFIDENCE.SHIP) return 'ship';
  if (confidence >= CONFIDENCE.SANDBOX_FLOOR) return 'sandbox';
  return 'refuse';
}

/**
 * A provenance-derived, one-line explanation (SPEC §8). Derived only from the source
 * tag — never a generated reason. The actual cited PCG ids live in `provenance`.
 */
export function explanationForSourceTag(tag: SourceTag): string {
  switch (tag) {
    case 'therapist-approved':
      return 'Approved by your therapist.';
    case 'family-validated':
      return 'A phrase your family confirmed.';
    case 'yours':
      return 'From your own past words.';
  }
}

/**
 * The single tag shown on a composed card. When multiple items compose one
 * candidate, the weakest provenance wins (therapist > family > yours), so the card
 * never over-claims validation.
 */
function weakestSourceTag(items: readonly PcgSourceItem[]): SourceTag {
  const rank: Record<SourceTag, number> = {
    yours: 0,
    'family-validated': 1,
    'therapist-approved': 2,
  };
  return items.reduce<SourceTag>(
    (weakest, item) => (rank[item.sourceTag] < rank[weakest] ? item.sourceTag : weakest),
    'therapist-approved',
  );
}

export interface BuildCandidateParams {
  /**
   * The PCG item(s) this candidate is decoded from. MUST be non-empty. For
   * `full_utterance`/`phrase`, items are joined in order (constrained composition).
   * For `autocomplete`, the first item supplies the completion.
   */
  readonly sourceItems: readonly PcgSourceItem[];
  readonly mode: SuggestionMode;
  /** Calibrated 0–1 confidence from the scoring pipeline (SPEC §7.1). */
  readonly confidence: number;
  /** Optional supporting edge ids for provenance. */
  readonly edgeIds?: readonly string[];
}

/**
 * Construct a user-facing suggestion candidate from PCG items. This is the ONLY
 * constructor for `SuggestionCandidate`. Throws `HardRuleViolation` if asked to
 * build from no PCG source, and refuses (returns `null`) below the sandbox floor —
 * the caller must surface a `RefusalResponse` instead (SPEC §7.2).
 */
export function buildCandidate(params: BuildCandidateParams): SuggestionCandidate | null {
  const { sourceItems, mode, confidence } = params;

  if (sourceItems.length === 0) {
    throw new HardRuleViolation('a suggestion must be grounded in at least one PCG item');
  }
  for (const item of sourceItems) {
    if (!item.nodeId) {
      throw new HardRuleViolation('every PCG source item must carry a node id for provenance');
    }
    if (item.text.trim().length === 0) {
      throw new HardRuleViolation('a PCG source item cannot contribute empty text');
    }
  }

  // Below the sandbox floor there is no candidate — this is the refusal path.
  if (confidence < CONFIDENCE.SANDBOX_FLOOR) return null;

  // Text is composed ONLY from PCG item text. No free-form input exists here.
  const text = sourceItems
    .map((item) => item.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const provenance: Provenance = {
    nodeIds: sourceItems.map((item) => item.nodeId),
    edgeIds: [...(params.edgeIds ?? [])],
  };

  const sourceTag = weakestSourceTag(sourceItems);
  return Object.freeze({
    text,
    mode,
    sourceTag,
    confidence,
    gate: confidence >= CONFIDENCE.SHIP ? 'ship' : 'sandbox',
    provenance,
    explanation: explanationForSourceTag(sourceTag),
  });
}

export interface GeneratedParams {
  /** The LLM-composed sentence. */
  readonly text: string;
  /**
   * PCG node ids used as grounding context (RAG). MAY be empty — on a cold start
   * there is little PCG to draw on, and the LLM still generates (SPEC D20). When
   * present, they're recorded as provenance so the grounding stays inspectable.
   */
  readonly groundingNodeIds: readonly string[];
  readonly sourceTag: SourceTag;
  readonly confidence: number;
  readonly mode: SuggestionMode;
  readonly edgeIds?: readonly string[];
}

/**
 * Build a candidate whose text was composed by the LLM (SPEC deviation D20). The
 * PCG is used as *information/context*, not a word-whitelist: the text need not be
 * verbatim from the PCG and grounding is optional (cold-start safe). Any grounding
 * used is recorded in `provenance`; the `generated` flag marks the candidate.
 */
export function composeGenerated(params: GeneratedParams): SuggestionCandidate | null {
  const text = params.text.trim();
  if (text.length === 0) {
    throw new HardRuleViolation('a generated suggestion cannot be empty');
  }
  if (params.confidence < CONFIDENCE.SANDBOX_FLOOR) return null;

  const grounded = params.groundingNodeIds.length > 0;
  return Object.freeze({
    text,
    mode: params.mode,
    sourceTag: params.sourceTag,
    confidence: params.confidence,
    gate: params.confidence >= CONFIDENCE.SHIP ? 'ship' : 'sandbox',
    provenance: {
      nodeIds: [...params.groundingNodeIds],
      edgeIds: [...(params.edgeIds ?? [])],
    },
    explanation: grounded
      ? explanationForSourceTag(params.sourceTag)
      : 'A suggestion for what you might mean.',
    generated: true,
  });
}

/**
 * Final automated hallucination check (SPEC §8, §22.8): every emitted suggestion
 * must carry ≥1 PCG source item. Call before a candidate leaves the server. Throws
 * on violation — a candidate with no provenance is a safety incident, not a bug.
 */
export function assertGrounded(candidate: SuggestionCandidate): void {
  if (candidate.provenance.nodeIds.length === 0) {
    throw new HardRuleViolation('emitted suggestion has no PCG provenance');
  }
}
