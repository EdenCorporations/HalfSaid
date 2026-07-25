/**
 * POST /v1/pcg/ingest (SPEC §13.5, deviation D20). Writes an utterance back into
 * the PCG and — when a Groq key is available — extracts the entities it mentions
 * and creates/links Person/Place/Object/Topic nodes plus an `expresses` edge to
 * the Intent. This is how the graph GROWS from conversations, so a cold start
 * warms up with use.
 *
 * Two sources feed it: `spoken` (an accepted/edited suggestion, after the undo
 * window) and `transcript` (what the user themselves typed or said into the mic —
 * their words are PCG material too). Repeats within 2 minutes de-duplicate onto
 * the existing row instead of spamming the log.
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
  /** 'spoken' (accepted suggestion) | 'transcript' (the user's own input). */
  source?: string;
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

export interface IngestResult {
  utteranceId: string;
  linked: number;
  deduped: boolean;
  entities: { people: string[]; places: string[]; objects: string[]; topics: string[] };
}

/**
 * Core ingest: persist an utterance (embedded), extract + link entities and the
 * intent. Shared by POST /v1/pcg/ingest and the /v1/pcg/chat companion.
 */
export async function ingestUtterance(
  deps: ApiDeps,
  exec: SqlExecutor,
  userId: string,
  content: string,
  mode: string,
  source: string,
): Promise<IngestResult> {
  const entities = { people: [], places: [], objects: [], topics: [] } as IngestResult['entities'];

  // Duplicate guard: the same phrase within 2 minutes reuses the existing row
  // (e.g. accept → undo → accept again, or repeated Go on the same input).
  // Only rows this API ingested count (they carry a `source`) — seed rows are
  // all "ingested" at DB-creation time and must never swallow a real ingest.
  const dup = await exec<{ id: string }>(
    `select id from public.pcg_nodes
      where user_id = $1 and node_type = 'Utterance' and superseded_by is null
        and attributes->>'content' = $2
        and attributes->>'source' is not null
        and ingestion_time > now() - interval '2 minutes'
      limit 1;`,
    [userId, content],
  );
  if (dup[0]) return { utteranceId: dup[0].id, linked: 0, deduped: true, entities };

  // Embed at ingest time so new utterances are immediately reachable by semantic
  // retrieval (the embedding column is write-once; inserting it up front is the
  // only mutation-free way in). Privacy tier 1 = the user's own words ('yours').
  const uttVec = await tryEmbed(deps.embedder, content);
  const utt = await exec<{ id: string }>(
    `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier, embedding)
       values ($1, 'Utterance', $2::jsonb, now(), 1, $3::vector)
       returning id;`,
    [userId, JSON.stringify({ content, mode, source }), uttVec],
  );
  const utteranceId = utt[0]!.id;

  let linked = 0;
  if (deps.llmApiKey) {
    try {
      const ents = await extractEntities(content, {
        apiKey: deps.llmApiKey,
        fetchImpl: deps.llmFetch,
      });
      entities.people = ents.people;
      entities.places = ents.places;
      entities.objects = ents.objects;
      entities.topics = ents.topics;
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
      // The communicative intent becomes an `expresses` edge — this is what lets
      // the predictive prior find habitual phrases by intent later.
      if (ents.intent) {
        const intentId = await upsertIntent(exec, userId, ents.intent);
        await exec(
          `insert into public.pcg_edges (user_id, edge_type, from_id, to_id, event_time)
             values ($1, 'expresses', $2, $3, now());`,
          [userId, utteranceId, intentId],
        );
        linked += 1;
      }
    } catch {
      /* extraction is best-effort — the utterance is already saved */
    }
  }

  return { utteranceId, linked, deduped: false, entities };
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
  const source = body.source === 'transcript' ? 'transcript' : 'spoken';

  const result = await ingestUtterance(
    deps,
    exec,
    userId,
    body.content.trim(),
    body.mode ?? 'full_utterance',
    source,
  );
  if (result.deduped) {
    return json({ utteranceId: result.utteranceId, linked: 0, deduped: true }, 200);
  }
  return json({ utteranceId: result.utteranceId, linked: result.linked }, 201);
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
      where user_id = $1 and node_type = $2 and lower(attributes->>'name') = lower($3)
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

/** Find or create the Intent node for this type (Intent uses `type`, not `name`). */
async function upsertIntent(exec: SqlExecutor, userId: string, intent: string): Promise<string> {
  const type = intent.toLowerCase().trim();
  const found = await exec<{ id: string }>(
    `select id from public.pcg_nodes
      where user_id = $1 and node_type = 'Intent' and attributes->>'type' = $2
        and superseded_by is null
      limit 1;`,
    [userId, type],
  );
  if (found[0]) return found[0].id;

  const created = await exec<{ id: string }>(
    `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier)
       values ($1, 'Intent', $2::jsonb, now(), 1)
       returning id;`,
    [userId, JSON.stringify({ type })],
  );
  return created[0]!.id;
}
