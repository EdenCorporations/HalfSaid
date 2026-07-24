'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary (gap: no global error UI). For a user who may not be
 * able to describe what went wrong, the recovery path must be one large, obvious
 * button — calm wording, no stack traces, never a dead end.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for the developer console only — the user never sees internals.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Nothing you said was lost. Try again — or go back home and start fresh.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
