"use client";

import "./globals.css";

// Last-resort boundary for errors thrown in the root layout itself. It
// replaces the whole document, so it ships its own <html>/<body> and leans on
// the default (dark) token theme from globals.css.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              The app hit an unexpected error. Reloading usually clears it.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
