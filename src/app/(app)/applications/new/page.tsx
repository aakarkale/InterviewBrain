import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getActiveApplicationCount } from "@/lib/applications/queries";
import { MAX_ACTIVE_APPLICATIONS } from "@/lib/applications/constants";
import { ApplicationForm } from "@/components/applications/application-form";

export const metadata: Metadata = { title: "New application" };

export default async function NewApplicationPage() {
  const activeCount = await getActiveApplicationCount();
  const atCap = activeCount >= MAX_ACTIVE_APPLICATIONS;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          New application
        </h1>
        <p className="text-sm text-muted-foreground">
          One vault per company. Everything here becomes context for your mock
          interviews.
        </p>
      </div>

      {atCap ? (
        <div className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          You&apos;re at the free limit of {MAX_ACTIVE_APPLICATIONS} active
          applications. Archive one from the dashboard to add another.
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <ApplicationForm />
        </div>
      )}
    </div>
  );
}
