'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

import { AppShell } from '@/components/brand/AppShell';
import { PersonaSwitcher } from '@/components/brand/PersonaSwitcher';
import { PcgMiniMap } from '@/components/pcg/PcgMiniMap';
import { FcmTrendChart } from '@/components/clinician/FcmTrendChart';
import { SessionStats } from '@/components/clinician/SessionStats';
import { ConversationLog } from '@/components/clinician/ConversationLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPersona } from '@/lib/client/persona';

/**
 * Clinician dashboard (SPEC §14). Real activity stats + searchable conversation
 * log + the living PCG map, alongside the FCM trend (visibly MOCK). Persona-aware:
 * the whole view is scoped to the selected demo persona's RLS-protected graph.
 */
export default function ClinicianPage() {
  const [personaName, setPersonaName] = useState('');
  useEffect(() => {
    setPersonaName(getPersona().name);
  }, []);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-h-touch w-fit items-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Home
            </Link>
            <PersonaSwitcher />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                Clinician Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Functional communication trend and conversation log
                {personaName ? ` for ${personaName}` : ''}.
              </p>
            </div>
            <Link
              href="/clinician/report"
              className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-foreground backdrop-blur transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Export report (PDF)
            </Link>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <SessionStats />
          <FcmTrendChart />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Communication Graph</CardTitle>
            <CardDescription>
              The living graph behind every suggestion — hubs sized by connections, colored by type.
              It grows as {personaName || 'the user'} speaks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PcgMiniMap height={360} />
          </CardContent>
        </Card>

        <ConversationLog />
      </div>
    </AppShell>
  );
}
