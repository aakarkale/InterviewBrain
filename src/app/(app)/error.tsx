"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Error boundary for the authenticated app segment. Server queries (vault,
// brain, sessions) throw on failure; without this, the user hits Next's
// default crash screen. Reset re-runs the failed render.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced for now; Sentry wiring is its own task.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          We hit an unexpected error loading this page. Trying again usually
          clears it.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
