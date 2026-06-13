import Link from "next/link";

import { Button } from "@/components/ui/button";

// Global 404. notFound() (used by the application and session routes when a
// row is missing or not owned) renders this instead of Next's default.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-display text-6xl font-semibold tracking-tight text-primary">
        404
      </p>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This page doesn&apos;t exist, or it isn&apos;t yours to view.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
