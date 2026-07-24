/**
 * Hybrid retrieval (SPEC §5.1). Steps 1–4: construct parallel queries, run the four
 * sources, merge + de-duplicate near-variants, and apply the policy filter. Steps 5–6
 * (confidence + adaptive rank) run downstream. Returns a prelim-ordered shortlist.
 */

import type { Embedder } from './embeddings';
import { toVectorLiteral } from './embeddings';
import type { SqlExecutor } from './sql';
import {
  contentTokens,
  keywordSearch,
  priorSearch,
  semanticSearch,
  subgraphSearch,
  type RawHit,
} from './store';
import {
  sourceTagForTier,
  type RetrievalScores,
  type RetrievedCandidate,
  type SuggestionContext,
} from './types';
import { PrivacyTier } from '@halfsaid/shared-types';

export interface RetrieveOptions {
  /** Rows per source (SPEC §5.1 uses top-50). */
  perSource?: number;
  /** Shortlist size returned (SPEC §5.1 keeps top-20 into ranking). */
  topK?: number;
}

const PRELIM_WEIGHTS: RetrievalScores = {
  semantic: 0.35,
  keyword: 0.25,
  subgraph: 0.2,
  prior: 0.2,
};

/** Strip a generic opener so "I want to call Sarah" and "call Sarah" de-dupe. */
function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/^(i want to|i want|i would like to|i'd like to|please|can you|could you)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prelimScore(scores: RetrievalScores): number {
  return (
    scores.semantic * PRELIM_WEIGHTS.semantic +
    scores.keyword * PRELIM_WEIGHTS.keyword +
    scores.subgraph * PRELIM_WEIGHTS.subgraph +
    scores.prior * PRELIM_WEIGHTS.prior
  );
}

interface Group {
  repr: RawHit;
  salience: number;
  scores: RetrievalScores;
  ids: Set<string>;
}

export async function retrieve(
  exec: SqlExecutor,
  ctx: SuggestionContext,
  embedder: Embedder,
  options: RetrieveOptions = {},
): Promise<RetrievedCandidate[]> {
  const perSource = options.perSource ?? 50;
  const topK = options.topK ?? 20;

  // Step 1: query construction.
  const tokens = contentTokens(ctx.partialText);
  const queryVec = toVectorLiteral(await embedder.embed(ctx.partialText));
  const targets = [ctx.partnerId, ctx.placeId, ctx.topicId].filter((x): x is string => Boolean(x));

  // Step 2: hybrid retrieval (parallel).
  const [semantic, keyword, subgraph, prior] = await Promise.all([
    semanticSearch(exec, ctx.userId, queryVec, perSource),
    keywordSearch(exec, ctx.userId, tokens, perSource),
    subgraphSearch(exec, ctx.userId, targets, perSource),
    priorSearch(exec, ctx.userId, ctx.intent, perSource),
  ]);

  // Step 3: merge + de-duplicate near-variants (keeps the shortest form; unions the
  // per-source scores so a habitual phrase surfaced by the prior also gets credit for
  // the keyword/semantic signal of its "I want to ..." variant).
  const groups = new Map<string, Group>();
  const ingest = (hits: RawHit[], source: keyof RetrievalScores) => {
    for (const h of hits) {
      const key = normalizeContent(h.content);
      let g = groups.get(key);
      if (!g) {
        g = { repr: h, salience: h.salience, scores: zeroScores(), ids: new Set() };
        groups.set(key, g);
      }
      g.scores[source] = Math.max(g.scores[source], h.score);
      g.salience = Math.max(g.salience, h.salience);
      g.ids.add(h.nodeId);
      const shorter = h.content.length < g.repr.content.length;
      const sameLenMoreSalient =
        h.content.length === g.repr.content.length && h.salience > g.repr.salience;
      if (shorter || sameLenMoreSalient) g.repr = h;
    }
  };
  ingest(semantic, 'semantic');
  ingest(keyword, 'keyword');
  ingest(subgraph, 'subgraph');
  ingest(prior, 'prior');

  let candidates: RetrievedCandidate[] = [...groups.values()].map((g) => ({
    nodeId: g.repr.nodeId,
    content: g.repr.content,
    mode: g.repr.mode,
    privacyTier: g.repr.privacyTier as PrivacyTier,
    sourceTag: sourceTagForTier(g.repr.privacyTier as PrivacyTier),
    salience: g.salience,
    eventEpoch: g.repr.eventEpoch,
    scores: g.scores,
    mergedFrom: [...g.ids],
  }));

  // Step 4: policy filter. High-stakes (forced flag, SPEC §7.3) restricts to Tier 3;
  // ephemeral (Tier 0) never surfaces.
  candidates = candidates.filter((c) => c.privacyTier >= PrivacyTier.UserOnly);
  if (ctx.highStakes) {
    candidates = candidates.filter((c) => c.privacyTier === PrivacyTier.ClinicianPlus);
  }

  // Prelim ordering into the shortlist (real ordering is the adaptive ranker).
  return candidates.sort((a, b) => prelimScore(b.scores) - prelimScore(a.scores)).slice(0, topK);
}

function zeroScores(): RetrievalScores {
  return { semantic: 0, keyword: 0, subgraph: 0, prior: 0 };
}
