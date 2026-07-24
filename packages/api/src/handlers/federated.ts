/**
 * /v1/federated (SPEC §F). Cross-clinic learning of the communication model.
 *
 *   GET  /v1/federated/model     → the current aggregate model + round.
 *   POST /v1/federated/aggregate → aggregate submitted MASKED updates into a new
 *                                  model (Safety pinned), log the DP budget spent.
 *
 * A clinic computes its update locally and submits only a masked, DP-noised delta —
 * there is no endpoint that accepts raw feedback, features, or PCG data.
 */

import {
  RANKER_DIM,
  aggregateRound,
  vectorToWeights,
  weightsToVector,
  type ClinicUpdate,
} from '@halfsaid/federated';
import type { RankerWeights } from '@halfsaid/retrieval';

import type { ApiDeps } from '../deps';
import { apiError, json, methodNotAllowed, readJson } from '../http';

async function currentModel(exec: ReturnType<ApiDeps['executorFor']>) {
  const rows = await exec<{ round: number; weights: RankerWeights }>(
    `select round, weights from public.federated_model where id = 1;`,
  );
  return rows[0] ?? null;
}

export async function handleFederatedModel(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed(['GET']);
  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);

  const model = await currentModel(deps.executorFor(userId));
  if (!model) return apiError('no federated model', 404);
  return json({ round: model.round, weights: model.weights }, 200);
}

interface AggregateBody {
  updates: ClinicUpdate[];
  dp: { epsilon: number; delta: number };
}

export async function handleFederatedAggregate(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = await deps.resolveUserId(req);
  if (!userId) return apiError('unauthorized', 401);

  const body = await readJson<AggregateBody>(req);
  if (!body || !Array.isArray(body.updates) || body.updates.length === 0) {
    return apiError('updates (non-empty array of masked clinic updates) is required', 400);
  }
  for (const u of body.updates) {
    if (!Array.isArray(u.maskedDelta) || u.maskedDelta.length !== RANKER_DIM) {
      return apiError(`each update needs a maskedDelta of length ${RANKER_DIM}`, 400);
    }
  }
  const epsilon = Number(body.dp?.epsilon);
  const delta = Number(body.dp?.delta);
  if (!Number.isFinite(epsilon) || !Number.isFinite(delta)) {
    return apiError('dp.epsilon and dp.delta are required', 400);
  }

  const exec = deps.executorFor(userId);
  const model = await currentModel(exec);
  if (!model) return apiError('no federated model', 404);

  // Aggregate masked deltas (the masks cancel) and apply — Safety stays pinned.
  const nextVector = aggregateRound(weightsToVector(model.weights), body.updates);
  const nextWeights = vectorToWeights(nextVector);
  const nextRound = model.round + 1;

  await exec(
    `update public.federated_model set round = $1, weights = $2::jsonb, updated_at = now() where id = 1;`,
    [nextRound, JSON.stringify(nextWeights)],
  );
  await exec(
    `insert into public.federated_round_log (round, clinics, epsilon_spent, delta_spent)
       values ($1, $2, $3, $4);`,
    [nextRound, body.updates.length, epsilon, delta],
  );

  return json(
    { round: nextRound, weights: nextWeights, clinics: body.updates.length, epsilonSpent: epsilon },
    200,
  );
}
