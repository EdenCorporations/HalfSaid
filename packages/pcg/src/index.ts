/**
 * @halfsaid/pcg — Personal Communication Graph data layer.
 *
 * Phase 2 provides the canonical node/edge type lists (kept in lockstep with the
 * CHECK constraints in supabase/migrations/0001_pcg_schema.sql) and the test
 * harness. Typed query helpers + retrieval land in Phase 3–4.
 */

import type { NodeType, EdgeType } from '@halfsaid/shared-types';

/** The 11 node types, matching the pcg_nodes.node_type CHECK constraint. */
export const NODE_TYPES: readonly NodeType[] = [
  'User',
  'Person',
  'Place',
  'Object',
  'Routine',
  'Episode',
  'Utterance',
  'Emotion',
  'Intent',
  'Topic',
  'CulturalContext',
];

/** The 15 edge types, matching the pcg_edges.edge_type CHECK constraint. */
export const EDGE_TYPES: readonly EdgeType[] = [
  'spoke_to',
  'mentioned',
  'participates_in',
  'occurs_in',
  'precedes',
  'evokes',
  'expresses',
  'about',
  'replaces',
  'refined_by',
  'generates',
  'has_culture',
  'preferred_lang',
  'supersedes',
  'known_at',
];

/** Fixed 1024-d embedding dimension (SPEC §4.3). */
export const EMBEDDING_DIM = 1024;
