/**
 * LLM generation + entity extraction (D20). Groq is mocked via an injected fetch, so
 * these run in CI without a key. Proves generation works grounded AND cold-start, and
 * that extraction parses entities.
 */

import { generateSuggestions, extractEntities, type RetrievedCandidate } from '../index';

function mockGroq(content: string): typeof fetch {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  })) as unknown as typeof fetch;
}

const ctx = { userId: 'u', partialText: 'I want to', intent: 'request' };

const context: RetrievedCandidate[] = [
  {
    nodeId: 'n1',
    content: 'call Sarah',
    mode: 'full_utterance',
    privacyTier: 2,
    sourceTag: 'family-validated',
    salience: 0.9,
    eventEpoch: 0,
    scores: { semantic: 0, keyword: 0, subgraph: 0, prior: 0.9 },
    mergedFrom: ['n1'],
  },
];

describe('generateSuggestions (D20)', () => {
  it('turns the LLM JSON into grounded generated candidates', async () => {
    const fetchImpl = mockGroq(
      JSON.stringify({ suggestions: ['I want to call Sarah', 'I need water', 'I am tired'] }),
    );
    const cands = await generateSuggestions(ctx, context, { apiKey: 'k', fetchImpl, count: 3 });
    expect(cands).toHaveLength(3);
    expect(cands.every((c) => c.generated)).toBe(true);
    expect(cands[0]!.provenance.nodeIds).toContain('n1'); // grounded in the context item
  });

  it('works on a cold start with no PCG context and still generates', async () => {
    const fetchImpl = mockGroq(JSON.stringify({ suggestions: ['I need help', 'I am okay'] }));
    const cands = await generateSuggestions(ctx, [], { apiKey: 'k', fetchImpl, count: 3 });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0]!.provenance.nodeIds).toEqual([]); // no grounding, no crash
    expect(cands[0]!.generated).toBe(true);
  });
});

describe('extractEntities (D20 ingestion)', () => {
  it('parses the mentioned entities from the LLM', async () => {
    const fetchImpl = mockGroq(
      JSON.stringify({
        people: ['Sarah'],
        places: ['the garden'],
        objects: [],
        topics: ['family'],
        intent: 'request',
      }),
    );
    const ents = await extractEntities('call Sarah about the garden', { apiKey: 'k', fetchImpl });
    expect(ents.people).toContain('Sarah');
    expect(ents.places).toContain('the garden');
    expect(ents.topics).toContain('family');
    expect(ents.intent).toBe('request');
  });
});
