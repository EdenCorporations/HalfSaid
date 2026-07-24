/**
 * /v1/pcg/nodes (SPEC §12, README §10.7). CRUD on the caller's own PCG nodes, RLS
 * enforced. Corrections are append-only: PATCH inserts a new row and points the
 * original's superseded_by at it (SPEC §4.4) — it never overwrites. DELETE revokes.
 */

import { NODE_TYPES } from '@halfsaid/pcg';
import type { SqlExecutor } from '@halfsaid/retrieval';
import type {
  NodeCorrectBody,
  NodeCreateBody,
  NodeDeleteBody,
  NodeType,
} from '@halfsaid/shared-types';

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed, readJson } from '../http';
import { NODE_COLUMNS, rowToNodeDTO, type NodeRow } from '../rows';

const NODE_TYPE_SET = new Set<string>(NODE_TYPES);

export async function handleNodes(req: Request, deps: ApiDeps): Promise<Response> {
  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);
  const exec = deps.executorFor(userId);

  switch (req.method) {
    case 'GET':
      return getNodes(req, exec);
    case 'POST':
      return createNode(req, userId, exec);
    case 'PATCH':
      return correctNode(req, userId, exec);
    case 'DELETE':
      return deleteNode(req, exec);
    default:
      return methodNotAllowed(['GET', 'POST', 'PATCH', 'DELETE']);
  }
}

async function getNodes(req: Request, exec: SqlExecutor) {
  const url = new URL(req.url);
  const nodeType = url.searchParams.get('nodeType');
  const includeSuperseded = url.searchParams.get('includeSuperseded') === 'true';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));

  if (nodeType && !NODE_TYPE_SET.has(nodeType)) return apiError('invalid nodeType', 400);

  const conds: string[] = [];
  const params: unknown[] = [];
  if (nodeType) {
    params.push(nodeType);
    conds.push(`node_type = $${params.length}`);
  }
  if (!includeSuperseded) conds.push('superseded_by is null');
  const where = conds.length ? `where ${conds.join(' and ')}` : '';
  params.push(limit);

  const rows = await exec<NodeRow>(
    `select ${NODE_COLUMNS} from public.pcg_nodes ${where}
      order by ingestion_time desc limit $${params.length};`,
    params,
  );
  return json({ nodes: rows.map(rowToNodeDTO) }, 200);
}

async function createNode(req: Request, userId: string, exec: SqlExecutor) {
  const body = await readJson<NodeCreateBody>(req);
  if (!body || !isNodeType(body.nodeType)) return apiError('valid nodeType is required', 400);
  if (typeof body.attributes !== 'object' || body.attributes === null) {
    return apiError('attributes (object) is required', 400);
  }
  const eventTime = body.eventTime ?? new Date().toISOString();
  const tier = body.privacyTier ?? 1;

  const rows = await exec<NodeRow>(
    `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier)
       values ($1, $2, $3::jsonb, $4, $5)
       returning ${NODE_COLUMNS};`,
    [userId, body.nodeType, JSON.stringify(body.attributes), eventTime, tier],
  );
  return json(rowToNodeDTO(rows[0]!), 201);
}

async function correctNode(req: Request, userId: string, exec: SqlExecutor) {
  const body = await readJson<NodeCorrectBody>(req);
  if (!body || typeof body.id !== 'string') return apiError('id is required', 400);
  if (typeof body.attributes !== 'object' || body.attributes === null) {
    return apiError('attributes (object) is required', 400);
  }

  const originals = await exec<NodeRow>(
    `select ${NODE_COLUMNS} from public.pcg_nodes where id = $1;`,
    [body.id],
  );
  const original = originals[0];
  if (!original) return apiError('node not found', 404);

  // Append-only correction: insert the new row, then point the original at it.
  const corrections = await exec<NodeRow>(
    `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier)
       values ($1, $2, $3::jsonb, $4, $5)
       returning ${NODE_COLUMNS};`,
    [
      userId,
      original.node_type,
      JSON.stringify(body.attributes),
      original.event_time,
      original.privacy_tier,
    ],
  );
  const correction = corrections[0]!;

  const updated = await exec<NodeRow>(
    `update public.pcg_nodes set superseded_by = $1 where id = $2 returning ${NODE_COLUMNS};`,
    [correction.id, body.id],
  );

  return json({ original: rowToNodeDTO(updated[0]!), correction: rowToNodeDTO(correction) }, 200);
}

async function deleteNode(req: Request, exec: SqlExecutor) {
  const body = await readJson<NodeDeleteBody>(req);
  if (!body || typeof body.id !== 'string') return apiError('id is required', 400);

  // MVP revocation is a hard delete (RLS-scoped). The 3-step audited revocation
  // (mark deleted -> propagate -> deletion proof) is post-MVP.
  const rows = await exec<{ id: string }>(
    `delete from public.pcg_nodes where id = $1 returning id;`,
    [body.id],
  );
  if (rows.length === 0) return apiError('node not found', 404);
  return json({ deleted: rows[0]!.id }, 200);
}

function isNodeType(v: unknown): v is NodeType {
  return typeof v === 'string' && NODE_TYPE_SET.has(v);
}
