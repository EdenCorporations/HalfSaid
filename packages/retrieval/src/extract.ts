/**
 * Entity extraction for PCG ingestion (SPEC §13.5 Enrich; deviation D20). Given an
 * utterance, the LLM pulls out the people / places / objects / topics mentioned and
 * the intent, so the conversation can be written back into the graph as new nodes +
 * edges. This is an internal op — its output never reaches the user as speech.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export interface ExtractedEntities {
  people: string[];
  places: string[];
  objects: string[];
  topics: string[];
  intent: string | null;
}

export interface ExtractOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const EMPTY: ExtractedEntities = {
  people: [],
  places: [],
  objects: [],
  topics: [],
  intent: null,
};

function toStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : [];
}

export async function extractEntities(
  content: string,
  opts: ExtractOptions,
): Promise<ExtractedEntities> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(GROQ_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract entities explicitly mentioned in an utterance. Return ONLY JSON: ' +
            '{"people":[],"places":[],"objects":[],"topics":[],"intent":""}. Use short ' +
            'canonical names (e.g. "Sarah", "the garden"). Omit anything not mentioned.',
        },
        { role: 'user', content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`groq extraction failed (${res.status})`);

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<
      string,
      unknown
    >;
    return {
      people: toStringArray(parsed.people),
      places: toStringArray(parsed.places),
      objects: toStringArray(parsed.objects),
      topics: toStringArray(parsed.topics),
      intent:
        typeof parsed.intent === 'string' && parsed.intent.trim() !== '' ? parsed.intent : null,
    };
  } catch {
    return EMPTY;
  }
}
