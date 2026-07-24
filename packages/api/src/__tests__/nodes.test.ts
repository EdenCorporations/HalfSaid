/**
 * /v1/pcg/nodes tests (SPEC §12). CRUD is RLS-scoped to the caller; PATCH is an
 * append-only correction (both rows retained, SPEC §4.4); DELETE revokes.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import type { NodeCorrectResponse, NodesResponse, PcgNodeDTO } from '@halfsaid/shared-types';

import { handleNodes } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';
const OTHER = '77777777-7777-4777-8777-777777777777';
const base = 'http://localhost/v1/pcg/nodes';

const req = (method: string, body?: unknown, query = ''): Request =>
  new Request(base + query, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

describe('/v1/pcg/nodes', () => {
  let t: TestDb;
  let h: TestDepsHandle;

  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
    // OTHER needs a users row to satisfy the FK when inserting.
    await t.exec(`insert into public.users (id, name) values ('${OTHER}', 'Other');`);
    h = makeTestDeps(t);
  });
  afterAll(async () => {
    await t.close();
  });

  it("GET returns only the caller's nodes and excludes superseded by default", async () => {
    h.setUser(MAYA);
    const res = await handleNodes(req('GET', undefined, '?nodeType=Person'), h.deps);
    expect(res.status).toBe(200);
    const data = (await res.json()) as NodesResponse;
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.nodes.every((n) => n.nodeType === 'Person')).toBe(true);
    expect(data.nodes.every((n) => n.supersededBy === null)).toBe(true);
  });

  it('POST creates a node and returns 201 with the DTO', async () => {
    h.setUser(MAYA);
    const res = await handleNodes(
      req('POST', { nodeType: 'Topic', attributes: { name: 'birds' }, privacyTier: 1 }),
      h.deps,
    );
    expect(res.status).toBe(201);
    const node = (await res.json()) as PcgNodeDTO;
    expect(node.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(node.attributes.name).toBe('birds');
  });

  it('PATCH supersedes with a correction; the original is retained, not overwritten', async () => {
    h.setUser(MAYA);
    const created = (await (
      await handleNodes(
        req('POST', { nodeType: 'Utterance', attributes: { content: 'it was Saturday' } }),
        h.deps,
      )
    ).json()) as PcgNodeDTO;

    const res = await handleNodes(
      req('PATCH', { id: created.id, attributes: { content: 'actually Sunday' } }),
      h.deps,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as NodeCorrectResponse;
    expect(data.original.attributes.content).toBe('it was Saturday'); // not overwritten
    expect(data.original.supersededBy).toBe(data.correction.id);
    expect(data.correction.attributes.content).toBe('actually Sunday');

    // Default GET hides the superseded original; includeSuperseded surfaces it.
    const active = (await (
      await handleNodes(req('GET', undefined, '?nodeType=Utterance&limit=500'), h.deps)
    ).json()) as NodesResponse;
    expect(active.nodes.find((n) => n.id === created.id)).toBeUndefined();
  });

  it('DELETE revokes a node (404 afterwards)', async () => {
    h.setUser(MAYA);
    const created = (await (
      await handleNodes(req('POST', { nodeType: 'Topic', attributes: { name: 'temp' } }), h.deps)
    ).json()) as PcgNodeDTO;

    const del = await handleNodes(req('DELETE', { id: created.id }), h.deps);
    expect(del.status).toBe(200);
    const again = await handleNodes(req('DELETE', { id: created.id }), h.deps);
    expect(again.status).toBe(404);
  });

  it("RLS: another user cannot see or delete the caller's nodes", async () => {
    h.setUser(MAYA);
    const created = (await (
      await handleNodes(req('POST', { nodeType: 'Topic', attributes: { name: 'secret' } }), h.deps)
    ).json()) as PcgNodeDTO;

    h.setUser(OTHER);
    const list = (await (
      await handleNodes(req('GET', undefined, '?nodeType=Topic&limit=500'), h.deps)
    ).json()) as NodesResponse;
    expect(list.nodes.find((n) => n.id === created.id)).toBeUndefined();

    const del = await handleNodes(req('DELETE', { id: created.id }), h.deps);
    expect(del.status).toBe(404); // RLS hides it -> not found
  });

  it('returns 401 when unauthenticated', async () => {
    h.setUser(null);
    const res = await handleNodes(req('GET'), h.deps);
    expect(res.status).toBe(401);
  });
});
