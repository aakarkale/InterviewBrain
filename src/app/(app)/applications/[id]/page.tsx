import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getApplication, getApplicationTitle } from "@/lib/applications/queries";
import { ApplicationOverview } from "@/components/applications/application-overview";
import { DocumentsSection } from "@/components/applications/documents-section";
import { RoundsSection } from "@/components/applications/rounds-section";
import { Separator } from "@/components/ui/separator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const title = await getApplicationTitle(id);
  return {
    title: title
      ? `${title.company_name} · ${title.role_title}`
      : "Application",
  };
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getApplication(id);
  if (!data) notFound();

  const { application, rounds, documents } = data;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <ApplicationOverview application={application} />
      <Separator />
      <DocumentsSection applicationId={application.id} documents={documents} />
      <Separator />
      <RoundsSection applicationId={application.id} rounds={rounds} />
      <Separator />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Practice sessions</h2>
        <p className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
          Mock interviews built from this vault arrive next — you&apos;ll start
          them right here.
        </p>
      </section>
    </div>
  );
}
