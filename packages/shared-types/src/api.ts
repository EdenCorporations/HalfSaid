/**
 * HTTP API contracts for the /v1 surface (SPEC §12, README §10.7). Shared verbatim
 * between the Next.js route handlers and the web client. The authenticated user is
 * taken from the Supabase JWT — never from the request body.
 */

import type { NodeType, PcgNode, PrivacyTier } from './index';

/** Standard error envelope. */
export interface ApiError {
  error: string;
  code?: string;
}

// --- POST /v1/suggestions ----------------------------------------------------

/** Request body for POST /v1/suggestions. Response is `SuggestionsResponse`. */
export interface SuggestRequest {
  /** What the user has said/typed so far, e.g. "I want to". */
  partialText: string;
  intent?: string;
  partnerId?: string;
  placeId?: string;
  topicId?: string;
  /** Forced high-stakes flag (SPEC §7.3). */
  highStakes?: boolean;
  /** Cap on cards returned (defaults to 5). */
  maxCards?: number;
}

// --- /v1/pcg/nodes -----------------------------------------------------------

/** A PCG node as returned by the API (no raw embedding; owner-scoped). */
export interface PcgNodeDTO {
  id: string;
  nodeType: NodeType;
  attributes: Record<string, unknown>;
  eventTime: string;
  ingestionTime: string;
  supersededBy: string | null;
  privacyTier: PrivacyTier;
  salience: number;
}

/** GET /v1/pcg/nodes query. */
export interface NodesQuery {
  nodeType?: NodeType;
  /** Include superseded (historical) rows. Default false. */
  includeSuperseded?: boolean;
  limit?: number;
}

export interface NodesResponse {
  nodes: PcgNodeDTO[];
}

/** POST /v1/pcg/nodes body. */
export interface NodeCreateBody {
  nodeType: NodeType;
  attributes: Record<string, unknown>;
  eventTime?: string;
  privacyTier?: PrivacyTier;
}

/**
 * PATCH /v1/pcg/nodes body. Corrections are append-only (SPEC §4.4): a PATCH
 * inserts a NEW row and points the original's superseded_by at it. Both are
 * returned.
 */
export interface NodeCorrectBody {
  id: string;
  attributes: Record<string, unknown>;
}

export interface NodeCorrectResponse {
  original: PcgNodeDTO;
  correction: PcgNodeDTO;
}

/** DELETE /v1/pcg/nodes body. */
export interface NodeDeleteBody {
  id: string;
}

export interface NodeDeleteResponse {
  deleted: string;
}

// --- GET /v1/pcg/timeline ----------------------------------------------------

/** Memory Timeline filters (SPEC §13 Screen 2). */
export interface TimelineQuery {
  person?: string;
  topic?: string;
  emotion?: string;
  language?: string;
  limit?: number;
}

/** One Memory Timeline card. */
export interface TimelineItem {
  id: string;
  date: string;
  modality: string | null;
  summary: string;
  privacyTier: PrivacyTier;
}

export interface TimelineResponse {
  items: TimelineItem[];
}

/** Map a raw node row to its API DTO. */
export function toNodeDTO(n: PcgNode): PcgNodeDTO {
  return {
    id: n.id,
    nodeType: n.nodeType,
    attributes: n.attributes,
    eventTime: n.eventTime,
    ingestionTime: n.ingestionTime,
    supersededBy: n.supersededBy,
    privacyTier: n.privacyTier,
    salience: n.salience,
  };
}
