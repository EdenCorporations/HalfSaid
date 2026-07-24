/**
 * @halfsaid/shared-types — canonical TypeScript contracts shared between the web
 * client and the API route handlers.
 *
 * These mirror `docs/SPEC.md`:
 *   - PCG node/edge model              (SPEC §4.1–4.3)
 *   - privacy tiers                    (SPEC §6)
 *   - suggestion modes / source tags   (SPEC §2, §13)
 *   - confidence gates                 (SPEC §7.2)
 *   - provenance + suggestion response (SPEC §8, §12)
 *
 * NOTE: Phase 1 defines the shapes only. Retrieval/generation/safety logic that
 * populates them lands in Phase 3–4.
 */

// ---------------------------------------------------------------------------
// PCG model (SPEC §4)
// ---------------------------------------------------------------------------

/** The 11 PCG node types (SPEC §4.1). */
export type NodeType =
  | 'User'
  | 'Person'
  | 'Place'
  | 'Object'
  | 'Routine'
  | 'Episode'
  | 'Utterance'
  | 'Emotion'
  | 'Intent'
  | 'Topic'
  | 'CulturalContext';

/** The 15 PCG edge types (SPEC §4.2). */
export type EdgeType =
  | 'spoke_to'
  | 'mentioned'
  | 'participates_in'
  | 'occurs_in'
  | 'precedes'
  | 'evokes'
  | 'expresses'
  | 'about'
  | 'replaces'
  | 'refined_by'
  | 'generates'
  | 'has_culture'
  | 'preferred_lang'
  | 'supersedes'
  | 'known_at';

/**
 * Privacy tiers (SPEC §6). Enforced at the storage layer via RLS. There is no
 * admin role that can read Tier 1.
 */
export enum PrivacyTier {
  Ephemeral = 0,
  UserOnly = 1,
  FamilyPlus = 2,
  ClinicianPlus = 3,
}

/** Common columns on every PCG node (SPEC §4.3). Bi-temporal — never collapse. */
export interface PcgNode {
  id: string;
  userId: string;
  nodeType: NodeType;
  attributes: Record<string, unknown>;
  /** When the event occurred in the real world. */
  eventTime: string;
  /** When HalfSaid learned about it. */
  ingestionTime: string;
  /** Correction target; the original row is retained, never overwritten. */
  supersededBy: string | null;
  privacyTier: PrivacyTier;
  salience: number;
  /** 1024-d vector (SPEC §4.3). Omitted from most API payloads. */
  embedding?: number[];
}

/** Common columns on every PCG edge (SPEC §4.3). */
export interface PcgEdge {
  id: string;
  userId: string;
  edgeType: EdgeType;
  fromId: string;
  toId: string;
  attributes: Record<string, unknown> | null;
  eventTime: string;
  ingestionTime: string;
  supersededBy: string | null;
  weight: number;
}

// ---------------------------------------------------------------------------
// Suggestions (SPEC §2, §7, §8)
// ---------------------------------------------------------------------------

/** The three suggestion modes (SPEC §2, feature 6). */
export type SuggestionMode = 'autocomplete' | 'phrase' | 'full_utterance';

/** Source tag shown on a suggestion card (SPEC §13). */
export type SourceTag = 'yours' | 'family-validated' | 'therapist-approved';

/** Confidence gate outcome (SPEC §7.2). `refuse` never produces a card. */
export type ConfidenceGate = 'ship' | 'sandbox' | 'refuse';

/**
 * Provenance for a suggestion (SPEC §8). A suggestion MUST cite the actual PCG
 * items it derived from — this is how the Hard Rule is made auditable. Never a
 * generated, plausible-sounding reason.
 */
export interface Provenance {
  /** Non-empty. The PCG node id(s) the suggestion was constructed from. */
  nodeIds: string[];
  /** Optional supporting edge ids. */
  edgeIds: string[];
}

/**
 * A user-facing suggestion candidate. Per the Hard Rule (SPEC §0, §8), this can
 * only be constructed from PCG items — see @halfsaid/safety-policy. The type is
 * intentionally read-only and always carries provenance.
 */
export interface SuggestionCandidate {
  readonly text: string;
  readonly mode: SuggestionMode;
  readonly sourceTag: SourceTag;
  /** Calibrated 0–1 confidence (SPEC §7.1). */
  readonly confidence: number;
  /** Gate the confidence fell into (SPEC §7.2); only `ship`/`sandbox` reach here. */
  readonly gate: Exclude<ConfidenceGate, 'refuse'>;
  readonly provenance: Provenance;
  /**
   * One-line explanation (SPEC §8). For retrieved candidates this is provenance-
   * derived (from the source tag); for LLM-generated candidates it notes the
   * grounding. The cited PCG ids always live in `provenance`.
   */
  readonly explanation: string;
  /**
   * True when the text was composed by the LLM (grounded in the cited PCG items,
   * RAG-style) rather than taken verbatim from a PCG item. See SPEC deviation D20.
   */
  readonly generated?: boolean;
}

/**
 * The refusal path is a first-class feature (SPEC §2, §7.2), not an error. It
 * fires when no candidate clears 0.5 confidence.
 */
export interface RefusalResponse {
  kind: 'refusal';
  reason: string;
  /** Offered alternatives, e.g. "type", "switch mode", "ask SLP". */
  alternatives: string[];
}

export interface CandidatesResponse {
  kind: 'candidates';
  /** Up to 5 cards (SPEC §13). */
  candidates: SuggestionCandidate[];
}

/** Response of POST /v1/suggestions (SPEC §12). */
export type SuggestionsResponse = CandidatesResponse | RefusalResponse;

// ---------------------------------------------------------------------------
// HTTP API contracts (SPEC §12)
// ---------------------------------------------------------------------------

export type {
  ApiError,
  SuggestRequest,
  PcgNodeDTO,
  NodesQuery,
  NodesResponse,
  NodeCreateBody,
  NodeCorrectBody,
  NodeCorrectResponse,
  NodeDeleteBody,
  NodeDeleteResponse,
  TimelineQuery,
  TimelineItem,
  TimelineResponse,
} from './api';
export { toNodeDTO } from './api';
