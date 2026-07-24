'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import type { GraphResponse, TimelineResponse } from '@halfsaid/shared-types';

import { Button } from '@/components/ui/button';
import { getPersona, personaHeaders } from '@/lib/client/persona';

/**
 * Printable session report (Enhancement 14 — clinic-native proof point). A clean,
 * print-optimized summary of communication activity: session metadata, activity
 * stats, and the utterance list. "Export PDF" uses the browser's print-to-PDF —
 * zero dependencies, and the print stylesheet (globals.css @media print) renders
 * it as a white-paper clinical document.
 *
 * Synthetic-data rule (SPEC §14): the report is watermarked as demo data.
 */
export default function ClinicianReportPage() {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaCondition, setPersonaCondition] = useState('');
  const [error, setError] = useState(false);
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    const p = getPersona();
    setPersonaName(p.name);
    setPersonaCondition(p.condition);
    let active = true;
    (async () => {
      try {
        const [tRes, gRes] = await Promise.all([
          fetch('/api/v1/pcg/timeline?limit=500', { headers: personaHeaders() }),
          fetch('/api/v1/pcg/graph?limit=5', { headers: personaHeaders() }),
        ]);
        if (!tRes.ok || !gRes.ok) throw new Error();
        const t = (await tRes.json()) as TimelineResponse;
        const g = (await gRes.json()) as GraphResponse;
        if (active) {
          setTimeline(t);
          setGraph(g);
        }
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const items = timeline?.items ?? [];
  const week = 7 * 24 * 3600 * 1000;
  const last7 = items.filter((i) => Date.now() - Date.parse(i.date) <= week).length;
  const activeDays = new Set(items.map((i) => i.date.slice(0, 10))).size;

  return (
    <div className="print-report mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      {/* Screen-only chrome. */}
      <header className="print-hide flex items-center justify-between gap-3">
        <Link
          href="/clinician"
          className="inline-flex min-h-touch items-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </header>

      {/* The document. */}
      <article aria-label="Communication session report">
        <header className="border-b border-white/20 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            HalfSaid — Communication Report
          </p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-foreground">
            {personaName || 'Patient'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{personaCondition}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Generated {generatedAt.toLocaleString()} · ALL DATA SYNTHETIC — demo persona, not a
            real patient.
          </p>
        </header>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Couldn’t load the report data.
          </p>
        )}

        <section aria-label="Summary" className="mt-5">
          <h2 className="font-heading text-base font-semibold text-foreground">Summary</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Total utterances</dt>
              <dd className="font-medium text-foreground">{timeline?.total ?? items.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last 7 days</dt>
              <dd className="font-medium text-foreground">{last7}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active days</dt>
              <dd className="font-medium text-foreground">{activeDays}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PCG size</dt>
              <dd className="font-medium text-foreground">
                {graph ? `${graph.totals.nodes} nodes · ${graph.totals.edges} edges` : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="Utterances" className="mt-6">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Utterance log ({items.length}
            {timeline?.total && timeline.total > items.length ? ` of ${timeline.total}` : ''})
          </h2>
          {!timeline && !error && <p className="mt-2 text-sm text-muted-foreground">Loading…</p>}
          {timeline && (
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Utterance
                  </th>
                  <th scope="col" className="py-1.5 font-medium">
                    Mode
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-white/10 align-top">
                    <td className="whitespace-nowrap py-1.5 pr-3 text-muted-foreground">
                      {new Date(it.date).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 pr-3 text-foreground">{it.summary}</td>
                    <td className="py-1.5 text-muted-foreground">{it.modality ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-8 border-t border-white/20 pt-3 text-xs text-muted-foreground">
          HalfSaid Personal Communication Intelligence Platform — hackathon demo. Suggestions are
          grounded in the patient&apos;s own Personal Communication Graph; clinical measures shown
          elsewhere in this demo are synthetic.
        </footer>
      </article>
    </div>
  );
}
