'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import type {
  PrivacyTier,
  SourceTag,
  TimelineItem,
  TimelineResponse,
} from '@halfsaid/shared-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceTagBadge } from '@/components/canvas/SourceTagBadge';
import { personaHeaders } from '@/lib/client/persona';

const PAGE_SIZE = 15;

function tagForTier(tier: PrivacyTier): SourceTag {
  if (tier >= 3) return 'therapist-approved';
  if (tier === 2) return 'family-validated';
  return 'yours';
}

/**
 * Conversation log (SPEC §14) — utterances from the user's Memory Timeline
 * (/v1/pcg/timeline), now searchable (server-side `q`) and paginated with
 * "load more". Each accepted phrase spoken on the Canvas lands here.
 */
export function ConversationLog() {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box → server-side content search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (debouncedQuery) params.set('q', debouncedQuery);
        const res = await fetch(`/api/v1/pcg/timeline?${params}`, { headers: personaHeaders() });
        if (!res.ok) throw new Error(`request failed (${res.status})`);
        const data = (await res.json()) as TimelineResponse;
        if (active) {
          setItems(data.items);
          setTotal(data.total ?? data.items.length);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'failed to load');
      }
    })();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  async function loadMore() {
    if (!items) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(items.length),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);
      const res = await fetch(`/api/v1/pcg/timeline?${params}`, { headers: personaHeaders() });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
      const data = (await res.json()) as TimelineResponse;
      setItems([...items, ...data.items]);
      setTotal(data.total ?? total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = items !== null && items.length < total;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversation Log</CardTitle>
        <CardDescription>Recent utterances, newest first.</CardDescription>
        <div className="relative mt-2">
          <label htmlFor="log-search" className="sr-only">
            Search the conversation log
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="log-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search phrases…"
            className="min-h-touch w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Couldn’t load the log: {error}
          </p>
        )}
        {!items && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {debouncedQuery ? `No phrases match “${debouncedQuery}”.` : 'No conversation yet.'}
          </p>
        )}
        {items && items.length > 0 && (
          <>
            <ul className="flex flex-col divide-y divide-white/5">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{it.summary}</span>
                    <time dateTime={it.date} className="text-xs text-muted-foreground">
                      {new Date(it.date).toLocaleDateString()}
                    </time>
                  </div>
                  <SourceTagBadge tag={tagForTier(it.privacyTier)} />
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : `Load more (${items.length} of ${total})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
