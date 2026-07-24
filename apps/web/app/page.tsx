import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">HalfSaid</h1>
        <p className="text-lg text-muted-foreground">
          Personal Communication Intelligence Platform for people with aphasia. Suggestions are
          retrieved and constrained-decoded from your Personal Communication Graph — never generated
          free-form.
        </p>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Phase 1 scaffold — screens below are placeholders wired up in later phases.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversation Canvas</CardTitle>
            <CardDescription>Screen 1 — speak, get grounded suggestions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/canvas">Open Canvas</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinician Dashboard</CardTitle>
            <CardDescription>FCM trend (mock) + conversation log.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/clinician">Open Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
