'use client';

import { useCallback, useState } from 'react';
import type { SuggestRequest, SuggestionsResponse } from '@halfsaid/shared-types';

import { personaHeaders } from './persona';

/** Client hook: POST /v1/suggestions and hold the candidates/refusal response. */
export function useSuggestions() {
  const [response, setResponse] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (body: SuggestRequest) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/suggestions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...personaHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
      setResponse((await res.json()) as SuggestionsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setResponse(null), []);

  return { response, loading, error, request, reset };
}
