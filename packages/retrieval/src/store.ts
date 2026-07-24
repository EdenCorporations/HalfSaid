/**
 * PCG search primitives (SPEC §5.1 steps 1–2). Each is portable SQL run through the
 * SqlExecutor, so the same code works on PGlite and Postgres. All queries filter by
 * user_id and only return non-superseded Utterance rows.
 */

import type { SuggestionMode } from '@halfsaid/shared-types';
import type { SqlExecutor } from './sql';

export interface RawHit {
  nodeId: string;
  content: string;
  mode: SuggestionMode;
  privacyTier: number;
  salience: number;
  eventEpoch: number;
  score: number;
}

interface Row {
  id: string;
  content: string;
  mode: string | null;
  privacy_tier: number;
  salience: number;
  event_epoch: number;
  raw: number | null;
}

const SELECT = `
  u.id,
  u.attributes->>'content' as content,
  u.attributes->>'mode' as mode,
  u.privacy_tier,
  u.salience,
  extract(epoch from u.event_time) as event_epoch`;

function toHit(r: Row, score: number): RawHit {
  return {
    nodeId: r.id,
    content: r.content,
    mode: (r.mode as SuggestionMode) ?? 'phrase',
    privacyTier: r.privacy_tier,
    salience: Number(r.salience),
    eventEpoch: Number(r.event_epoch),
    score,
  };
}

const STOPWORDS = new Set(['i', 'to', 'a', 'an', 'the', 'my', 'of', 'is', 'it', 'and']);
export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Semantic search: cosine distance over the 1024-d embedding (SPEC §5.1). */
export async function semanticSearch(
  exec: SqlExecutor,
  userId: string,
  queryVectorLiteral: string,
  limit: number,
): Promise<RawHit[]> {
  const rows = await exec<Row & { sim: number }>(
    `select ${SELECT}, 1 - (u.embedding <=> $2::vector) as raw
       from public.pcg_nodes u
      where u.user_id = $1 and u.node_type = 'Utterance'
        and u.superseded_by is null and u.embedding is not null
      order by u.embedding <=> $2::vector
      limit $3;`,
    [userId, queryVectorLiteral, limit],
  );
  return rows.map((r) => toHit(r, Math.max(0, Number(r.raw ?? 0))));
}

/** Keyword search: content ILIKE any query token; score = fraction of tokens hit. */
export async function keywordSearch(
  exec: SqlExecutor,
  userId: string,
  tokens: string[],
  limit: number,
): Promise<RawHit[]> {
  if (tokens.length === 0) return [];
  const likeParams = tokens.map((t) => `%${t}%`);
  const clauses = tokens.map((_, i) => `u.attributes->>'content' ILIKE $${i + 2}`);
  const rows = await exec<Row>(
    `select ${SELECT}, null as raw
       from public.pcg_nodes u
      where u.user_id = $1 and u.node_type = 'Utterance' and u.superseded_by is null
        and (${clauses.join(' or ')})
      limit ${Math.max(1, limit * 3)};`,
    [userId, ...likeParams],
  );
  return rows
    .map((r) => {
      const c = (r.content ?? '').toLowerCase();
      const hits = tokens.filter((t) => c.includes(t)).length;
      return toHit(r, hits / tokens.length);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Subgraph search: utterances that mention/are-about/occur-in the context entities. */
export async function subgraphSearch(
  exec: SqlExecutor,
  userId: string,
  targetIds: string[],
  limit: number,
): Promise<RawHit[]> {
  if (targetIds.length === 0) return [];
  const rows = await exec<Row & { hits: number }>(
    `select ${SELECT}, count(*) as raw
       from public.pcg_nodes u
       join public.pcg_edges e on e.from_id = u.id
      where u.user_id = $1 and u.node_type = 'Utterance' and u.superseded_by is null
        and e.edge_type in ('mentioned','about','occurs_in')
        and e.to_id = any($2)
      group by u.id
      order by count(*) desc
      limit $3;`,
    [userId, targetIds, limit],
  );
  const max = Math.max(1, ...rows.map((r) => Number(r.raw ?? 1)));
  return rows.map((r) => toHit(r, Number(r.raw ?? 1) / max));
}

/**
 * Predictive prior (PRD §13.6): the user's most salient (and recent) utterances,
 * optionally of a given intent. This is what surfaces habitual phrases when the
 * partial text is a generic opener like "I want to".
 */
export async function priorSearch(
  exec: SqlExecutor,
  userId: string,
  intent: string | undefined,
  limit: number,
): Promise<RawHit[]> {
  const intentJoin = intent
    ? `join public.pcg_edges ex on ex.from_id = u.id and ex.edge_type = 'expresses'
       join public.pcg_nodes it on it.id = ex.to_id and it.attributes->>'type' = $2`
    : '';
  const params = intent ? [userId, intent, limit] : [userId, limit];
  const limitParam = intent ? '$3' : '$2';
  const rows = await exec<Row>(
    `select ${SELECT}, u.salience as raw
       from public.pcg_nodes u
       ${intentJoin}
      where u.user_id = $1 and u.node_type = 'Utterance' and u.superseded_by is null
      order by u.salience desc, u.event_time desc
      limit ${limitParam};`,
    params,
  );
  return rows.map((r) => toHit(r, Number(r.salience)));
}
