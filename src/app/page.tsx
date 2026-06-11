import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder landing — replaced by the full motion-system landing
// page at the end of Phase 1.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        InterviewBrain
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        One vault per application. One brain across all of them.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
