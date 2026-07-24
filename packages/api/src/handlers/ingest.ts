/**
 * POST /v1/pcg/ingest (SPEC §13.5, deviation D20). Writes a spoken/typed utterance
 * back into the PCG and — when a Groq key is available — extracts the entities it
 * mentions and creates/links Person/Place/Object/Topic nodes. This is how the graph
 * GROWS from conversations, so a cold start warms up with use.
 *
 * RLS-scoped to the caller. Entity extraction is best-effort: a failure still
 * persists the utterance.
 */

import { extractEntities, toVectorLiteral, type Embedder } from '@halfsaid/retrieval';
import type { SqlExecutor } from '@halfsaid/retrieval';
import type { NodeType } from '@halfsaid/shared-types';

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed, readJson } from '../http';

interface IngestBody {
  content: string;
  mode?: string;
}

/** Best-effort embedding — a network failure must never block ingest. */
async function tryEmbed(embedder: Embedder | undefined, text: string): Promise<string | null> {
  if (!embedder) return null;
  try {
    return toVectorLiteral(await embedder.embed(text));
  } catch {
    return null;
  }
}

export async function handleIngest(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);
  const exec = deps.executorFor(userId);

  const body = await readJson<IngestBody>(req);
  if (!body || typeof body.content !== 'string' || body.content.trim() === '') {
    return apiError('content (non-empty string) is required', 400);
  }

  // Embed at ingest time so new utterances are immediately reachable by semantic
  // retrieval (the embedding column is write-once; inserting it up front is the
  // only mutation-free way in).
  const uttVec = await tryEmbed(deps.embedder, body.content);
  const utt = await exec<{ id: string }>(
    `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier, embedding)
       values ($1, 'Utterance', $2::jsonb, now(), 2, $3::vector)
       returning id;`,
    [
      userId,
      JSON.stringify({
        content: body.content,
        mode: body.mode ?? 'full_utterance',
        source: 'spoken',
      }),
      uttVec,
    ],
  );
  const utteranceId = utt[0]!.id;

  let linked = 0;
  if (deps.llmApiKey) {
    try {
      const ents = await extractEntities(body.content, { apiKey: deps.llmApiKey });
      const groups: Array<[NodeType, string, string[]]> = [
        ['Person', 'mentioned', ents.people],
        ['Place', 'mentioned', ents.places],
        ['Object', 'mentioned', ents.objects],
        ['Topic', 'about', ents.topics],
      ];
      for (const [nodeType, edgeType, names] of groups) {
        for (const name of names) {
          const entityId = await upsertNamed(exec, userId, nodeType, name, deps.embedder);
          await exec(
            `insert into public.pcg_edges (user_id, edge_type, from_id, to_id, event_time)
               values ($1, $2, $3, $4, now());`,
            [userId, edgeType, utteranceId, entityId],
          );
          linked += 1;
        }
      }
    } catch {
      /* extraction is best-effort — the utterance is already saved */
    }
  }

  return json({ utteranceId, linked }, 201);
}

/** Find a same-named node for this user, or create one (embedded); returns its id. */
async function upsertNamed(
  exec: SqlExecutor,
  userId: string,
  nodeType: NodeType,
  name: string,
  embedder?: Embedder,
): Promise<string> {
  const found = await exec<{ id: string }>(
    `select id from public.pcg_nodes
      where user_id = $1 and node_type = $2 and attributes->>'name' = $3
        and superseded_by is null
      limit 1;`,
    [userId, nodeType, name],
  );
  if (found[0]) return found[0].id;

  const vec = await tryEmbed(embedder, name);
  const created = await exec<{ id: string }>(
    `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier, embedding)
       values ($1, $2, $3::jsonb, now(), 2, $4::vector)
       returning id;`,
    [userId, nodeType, JSON.stringify({ name }), vec],
  );
  return created[0]!.id;
}
