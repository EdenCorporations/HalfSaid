'use client';

import { useEffect, useState } from 'react';
import type { TimelineResponse } from '@halfsaid/shared-types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { personaHeaders } from '@/lib/client/persona';

interface Stats {
  total: number;
  last7days: number;
  activeDays: number;
  topPhrases: Array<{ text: string; count: number }>;
}

function computeStats(data: TimelineResponse): Stats {
  const now = Date.now();
  const week = 7 * 24 * 3600 * 1000;
  const counts = new Map<string, number>();
  const days = new Set<string>();
  let last7days = 0;
  for (const item of data.items) {
    const t = Date.parse(item.date);
    if (now - t <= week) last7days += 1;
    days.add(item.date.slice(0, 10));
    const key = item.summary.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const topPhrases = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([text, count]) => ({ text, count }));
  return { total: data.total ?? data.items.length, last7days, activeDays: days.size, topPhrases };
}

/**
 * Session statistics (Enhancement 8) — REAL numbers computed from the user's
 * Memory Timeline, in deliberate contrast to the mock FCM chart beside it. Proves
 * the system is collecting meaningful data, not just displaying fixtures.
 */
export function SessionStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/pcg/timeline?limit=500', { headers: personaHeaders() });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as TimelineResponse;
        if (active) setStats(computeStats(data));
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Communication Activity</CardTitle>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            LIVE DATA
          </span>
        </div>
        <CardDescription>Computed from the Personal Communication Graph timeline.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Couldn’t load activity stats.
          </p>
        )}
        {!stats && !error && <p className="text-sm text-muted-foreground">Computing…</p>}
        {stats && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-3 text-center">
                <dt className="text-xs text-muted-foreground">Utterances</dt>
                <dd className="font-heading text-2xl font-semibold text-foreground">
                  {stats.total}
                </dd>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <dt className="text-xs text-muted-foreground">Last 7 days</dt>
                <dd className="font-heading text-2xl font-semibold text-foreground">
                  {stats.last7days}
                </dd>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <dt className="text-xs text-muted-foreground">Active days</dt>
                <dd className="font-heading text-2xl font-semibold text-foreground">
                  {stats.activeDays}
                </dd>
              </div>
            </dl>
            {stats.topPhrases.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Most-used phrases
                </h3>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {stats.topPhrases.map((p) => (
                    <li
                      key={p.text}
                      className="flex items-center justify-between gap-2 text-sm text-foreground"
                    >
                      <span className="truncate">“{p.text}”</span>
                      <span className="shrink-0 text-xs text-muted-foreground">×{p.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
