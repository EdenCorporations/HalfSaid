/**
 * @halfsaid/retrieval — turns PCG contents into ranked, grounded, safe suggestion
 * candidates (SPEC §5, §7, §8). Assembled across Phase 3:
 *   embeddings -> hybrid retrieval -> adaptive ranker -> confidence + gates ->
 *   constrained generation (safety-policy) -> suggest().
 */

export {
  EMBEDDING_DIM,
  MockEmbedder,
  HostedEmbedder,
  getEmbedder,
  backfillEmbeddings,
  toVectorLiteral,
  cosine,
} from './embeddings';
export type { Embedder, BackfillResult } from './embeddings';
export type { SqlExecutor } from './sql';

export { retrieve, prelimScore, type RetrieveOptions } from './retrieve';
export {
  contentTokens,
  semanticSearch,
  keywordSearch,
  subgraphSearch,
  priorSearch,
  type RawHit,
} from './store';
export {
  sourceTagForTier,
  type SuggestionContext,
  type RetrievedCandidate,
  type RetrievalScores,
} from './types';
