import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Simple clinician dashboard (SPEC §14). Phase 1 renders the skeleton. The FCM
 * trend is MOCK and must be visibly labelled as such — synthetic clinical scores
 * must never be mistaken for real measurement. Real chart + conversation log land
 * in Phase 6.
 */
export default function ClinicianPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Clinician Dashboard</h1>
        <p className="text-sm text-muted-foreground">FCM trend and conversation log.</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">FCM Trend</CardTitle>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              MOCK DATA
            </span>
          </div>
          <CardDescription>
            Functional Communication Measure over time — synthetic sample, not a real clinical
            measurement.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Chart implemented in Phase 6.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation Log</CardTitle>
          <CardDescription>Entries written by accepted suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Log implemented in Phase 6.
        </CardContent>
      </Card>
    </div>
  );
}
