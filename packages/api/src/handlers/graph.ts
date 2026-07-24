/**
 * GET /v1/pcg/graph (SPEC §13 — PCG mini-map + growth counter). Returns the
 * most-connected slice of the caller's graph (hub entities + the utterances that
 * link them) plus whole-graph totals, so the UI can render the PCG and show it
 * growing. RLS-scoped; superseded rows are excluded.
 */

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed } from '../http';

interface GraphNodeRow {
  id: string;
  node_type: string;
  label: string | null;
  salience: number;
  degree: number;
}

interface GraphEdgeRow {
  from_id: string;
  to_id: string;
  edge_type: string;
}

export async function handleGraph(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);

  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);
  const exec = deps.executorFor(userId);

  const url = new URL(req.url);
  const limit = Math.min(120, Math.max(5, Number(url.searchParams.get('limit')) || 48));

  // Rank by degree (connection count): the hubs are what make the graph legible.
  const nodes = await exec<GraphNodeRow>(
    `with deg as (
       select n.id, count(e.id)::int as degree
         from public.pcg_nodes n
         left join public.pcg_edges e on (e.from_id = n.id or e.to_id = n.id)
        where n.user_id = $1 and n.superseded_by is null
        group by n.id
     )
     select n.id,
            n.node_type,
            coalesce(n.attributes->>'name', n.attributes->>'content', n.attributes->>'type') as label,
            n.salience,
            d.degree
       from public.pcg_nodes n
       join deg d on d.id = n.id
      where n.user_id = $1 and n.superseded_by is null
      order by d.degree desc, n.salience desc, n.event_time desc
      limit $2;`,
    [userId, limit],
  );

  const ids = nodes.map((n) => n.id);
  const edges =
    ids.length === 0
      ? []
      : await exec<GraphEdgeRow>(
          `select from_id, to_id, edge_type
             from public.pcg_edges
            where user_id = $1 and from_id = any($2::uuid[]) and to_id = any($2::uuid[]);`,
          [userId, ids],
        );

  const totals = await exec<{ nodes: number; edges: number }>(
    `select (select count(*)::int from public.pcg_nodes
              where user_id = $1 and superseded_by is null) as nodes,
            (select count(*)::int from public.pcg_edges
              where user_id = $1) as edges;`,
    [userId],
  );

  return json(
    {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.node_type,
        label: n.label ?? n.node_type,
        salience: Number(n.salience),
        degree: n.degree,
      })),
      edges: edges.map((e) => ({ from: e.from_id, to: e.to_id, type: e.edge_type })),
      totals: totals[0] ?? { nodes: 0, edges: 0 },
    },
    200,
  );
}
