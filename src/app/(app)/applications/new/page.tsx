import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getActiveApplicationCount } from "@/lib/applications/queries";
import { MAX_ACTIVE_APPLICATIONS } from "@/lib/applications/constants";
import { ApplicationForm } from "@/components/applications/application-form";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "New interview" };

export default async function NewApplicationPage() {
  const activeCount = await getActiveApplicationCount();
  const atCap = activeCount >= MAX_ACTIVE_APPLICATIONS;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Interviews
      </Link>

      <PageHeader
        title="New interview"
        description="One vault per company. Everything here becomes context for your mock interviews."
      />

      {atCap ? (
        <div className="rounded-lg border border-dashed bg-surface-0/40 p-5 text-sm text-muted-foreground">
          You&apos;re at the free limit of {MAX_ACTIVE_APPLICATIONS} active
          interviews. Archive one from the dashboard to add another.
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5">
          <ApplicationForm />
        </div>
      )}
    </div>
  );
}
