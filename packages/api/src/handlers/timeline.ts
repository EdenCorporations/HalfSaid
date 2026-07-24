/**
 * GET /v1/pcg/timeline (SPEC §12, §13 Screen 2). The Memory Timeline — the user's
 * own utterances in reverse-chronological order, filterable by person, topic,
 * emotion, and language. RLS-scoped; superseded rows are excluded.
 */

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed } from '../http';

interface TimelineRow {
  id: string;
  event_time: string | Date;
  modality: string | null;
  summary: string | null;
  privacy_tier: number;
}

export async function handleTimeline(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);

  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);
  const exec = deps.executorFor(userId);

  const url = new URL(req.url);
  const person = url.searchParams.get('person');
  const topic = url.searchParams.get('topic');
  const emotion = url.searchParams.get('emotion');
  const language = url.searchParams.get('language');
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));

  const params: unknown[] = [userId];
  const conds: string[] = [
    `u.user_id = $1`,
    `u.node_type = 'Utterance'`,
    `u.superseded_by is null`,
  ];

  if (language) {
    params.push(language);
    conds.push(`u.attributes->>'language' = $${params.length}`);
  }
  // Each entity filter is an EXISTS over the relevant edge, matching by name/type.
  if (person) {
    params.push(person);
    conds.push(mentionsExists('mentioned', 'name', params.length));
  }
  if (topic) {
    params.push(topic);
    conds.push(mentionsExists('about', 'name', params.length));
  }
  if (emotion) {
    params.push(emotion);
    conds.push(mentionsExists('evokes', 'type', params.length));
  }
  params.push(limit);

  const rows = await exec<TimelineRow>(
    `select u.id,
            u.event_time,
            u.attributes->>'mode' as modality,
            u.attributes->>'content' as summary,
            u.privacy_tier
       from public.pcg_nodes u
      where ${conds.join(' and ')}
      order by u.event_time desc
      limit $${params.length};`,
    params,
  );

  return json(
    {
      items: rows.map((r) => ({
        id: r.id,
        date:
          r.event_time instanceof Date
            ? r.event_time.toISOString()
            : new Date(r.event_time).toISOString(),
        modality: r.modality,
        summary: r.summary ?? '',
        privacyTier: r.privacy_tier,
      })),
    },
    200,
  );
}

/** EXISTS clause: the utterance has `edgeType` to a node whose `attr` matches $n. */
function mentionsExists(edgeType: string, attr: string, paramIndex: number): string {
  return `exists (
    select 1 from public.pcg_edges e
      join public.pcg_nodes n on n.id = e.to_id
     where e.from_id = u.id and e.edge_type = '${edgeType}'
       and (n.id::text = $${paramIndex} or n.attributes->>'${attr}' = $${paramIndex})
  )`;
}
