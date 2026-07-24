/**
 * POST /v1/suggestions (SPEC §12, README §10.7). Context in → ranked candidates +
 * confidence + provenance out (or a first-class refusal). The user comes from the
 * JWT, never the body.
 */

import { suggest } from '@halfsaid/retrieval';
import type { SuggestRequest } from '@halfsaid/shared-types';

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed, readJson } from '../http';

export async function handleSuggestions(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);

  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);

  const body = await readJson<SuggestRequest>(req);
  if (!body || typeof body.partialText !== 'string') {
    return apiError('partialText (string) is required', 400);
  }

  const exec = deps.executorFor(userId);
  const response = await suggest(
    exec,
    {
      userId,
      partialText: body.partialText,
      intent: body.intent,
      partnerId: body.partnerId,
      placeId: body.placeId,
      topicId: body.topicId,
      highStakes: body.highStakes,
    },
    {
      embedder: deps.embedder,
      nowEpoch: deps.now?.(),
      maxCards: body.maxCards,
    },
  );

  return json(response, 200);
}
