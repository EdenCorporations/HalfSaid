import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { AppShell } from '@/components/brand/AppShell';
import { FcmTrendChart } from '@/components/clinician/FcmTrendChart';
import { ConversationLog } from '@/components/clinician/ConversationLog';

/**
 * Simple clinician dashboard (SPEC §14). FCM trend (visibly MOCK) + conversation log.
 * Restyled into the HalfSaid companion aesthetic; content and MOCK labelling unchanged.
 */
export default function ClinicianPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex min-h-touch w-fit items-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white">
              Clinician Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Functional communication trend and conversation log for Maya.
            </p>
          </div>
        </header>
        <FcmTrendChart />
        <ConversationLog />
      </div>
    </AppShell>
  );
}
