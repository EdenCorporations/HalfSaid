'use client';

import { useEffect, useState } from 'react';
import type {
  PrivacyTier,
  SourceTag,
  TimelineItem,
  TimelineResponse,
} from '@halfsaid/shared-types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceTagBadge } from '@/components/canvas/SourceTagBadge';

function tagForTier(tier: PrivacyTier): SourceTag {
  if (tier >= 3) return 'therapist-approved';
  if (tier === 2) return 'family-validated';
  return 'yours';
}

/**
 * Conversation log (SPEC §14) — recent utterances from the user's Memory Timeline
 * (/v1/pcg/timeline). Each accepted phrase spoken on the Canvas lands here.
 */
export function ConversationLog() {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/pcg/timeline?limit=15');
        if (!res.ok) throw new Error(`request failed (${res.status})`);
        const data = (await res.json()) as TimelineResponse;
        if (active) setItems(data.items);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'failed to load');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversation Log</CardTitle>
        <CardDescription>Recent utterances, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Couldn’t load the log: {error}
          </p>
        )}
        {!items && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No conversation yet.</p>
        )}
        {items && items.length > 0 && (
          <ul className="flex flex-col divide-y">
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
        )}
      </CardContent>
    </Card>
  );
}
