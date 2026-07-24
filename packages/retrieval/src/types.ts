import type { PrivacyTier, SourceTag, SuggestionMode } from '@halfsaid/shared-types';

/** The context a suggestion is retrieved for (SPEC §5.1). */
export interface SuggestionContext {
  userId: string;
  /** What the user has said/typed so far, e.g. "I want to". */
  partialText: string;
  /** Inferred communicative intent (internal op), e.g. "request". */
  intent?: string;
  /** Optional grounding entities for subgraph traversal. */
  partnerId?: string;
  placeId?: string;
  topicId?: string;
  /**
   * High-stakes context (SPEC §7.3). MVP does not detect it; this forced flag
   * proves the interception seam. When true, only Tier 3 items may surface.
   */
  highStakes?: boolean;
}

/** Per-source retrieval scores for one candidate. */
export interface RetrievalScores {
  semantic: number;
  keyword: number;
  subgraph: number;
  prior: number;
}

/** A PCG utterance retrieved as a suggestion candidate (pre-ranking). */
export interface RetrievedCandidate {
  nodeId: string;
  content: string;
  mode: SuggestionMode;
  privacyTier: PrivacyTier;
  sourceTag: SourceTag;
  salience: number;
  eventEpoch: number;
  scores: RetrievalScores;
  /** Node ids that contributed to this candidate after de-duplication. */
  mergedFrom: string[];
}

/** Map a privacy tier to its suggestion-card source tag (SPEC §13). */
export function sourceTagForTier(tier: PrivacyTier): SourceTag {
  if (tier >= 3) return 'therapist-approved';
  if (tier === 2) return 'family-validated';
  return 'yours';
}
