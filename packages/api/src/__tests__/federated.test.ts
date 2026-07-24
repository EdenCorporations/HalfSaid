/**
 * /v1/federated tests (SPEC §F). The model starts at the ranker's initial weights;
 * aggregating masked clinic updates advances the round, moves the model, keeps the
 * Safety weight pinned, and logs the DP budget. Only masked deltas are accepted.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';

import { handleFederatedModel, handleFederatedAggregate } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';

const get = () => new Request('http://localhost/v1/federated/model', { method: 'GET' });
const post = (body?: unknown) =>
  new Request('http://localhost/v1/federated/aggregate', {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

describe('/v1/federated', () => {
  let t: TestDb;
  let h: TestDepsHandle;

  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
    h = makeTestDeps(t);
  });
  afterAll(async () => {
    await t.close();
  });

  it('GET model returns the seeded initial model at round 0', async () => {
    h.setUser(MAYA);
    const res = await handleFederatedModel(get(), h.deps);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { round: number; weights: { safety: number } };
    expect(data.round).toBe(0);
    expect(data.weights.safety).toBe(0.15);
  });

  it('aggregates masked updates, advancing the model with Safety pinned', async () => {
    h.setUser(MAYA);
    const updates = [
      { clinicId: 'brooks', maskedDelta: [0.2, 0, 0.9, 0, 0, 0], sampleCount: 10 },
      { clinicId: 'kessler', maskedDelta: [0.0, 0, 0.9, 0, 0, 0], sampleCount: 10 },
    ];
    const res = await handleFederatedAggregate(
      post({ updates, dp: { epsilon: 1, delta: 1e-5 } }),
      h.deps,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      round: number;
      clinics: number;
      weights: { relevance: number; safety: number };
    };
    expect(data.round).toBe(1);
    expect(data.clinics).toBe(2);
    expect(data.weights.relevance).toBeCloseTo(0.45, 6); // 0.35 + mean(0.2, 0)
    expect(data.weights.safety).toBe(0.15); // pinned — never moved by federation

    // a round-log row was written
    await t.become({ kind: 'postgres' });
    const log = await t.query<{ n: number }>(
      `select count(*)::int as n from public.federated_round_log where round = 1;`,
    );
    expect(log[0]!.n).toBe(1);
  });

  it('rejects raw / malformed submissions', async () => {
    h.setUser(MAYA);
    expect((await handleFederatedAggregate(post({ updates: [] }), h.deps)).status).toBe(400);
    expect(
      (
        await handleFederatedAggregate(
          post({
            updates: [{ clinicId: 'x', maskedDelta: [1, 2], sampleCount: 1 }],
            dp: { epsilon: 1, delta: 1e-5 },
          }),
          h.deps,
        )
      ).status,
    ).toBe(400); // wrong-length delta
    h.setUser(null);
    expect((await handleFederatedModel(get(), h.deps)).status).toBe(401);
  });
});
