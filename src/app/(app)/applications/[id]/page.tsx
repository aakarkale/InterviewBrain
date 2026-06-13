import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getApplication, getApplicationTitle } from "@/lib/applications/queries";
import { getSessionsForApplication } from "@/lib/sessions/queries";
import { ApplicationOverview } from "@/components/applications/application-overview";
import { DocumentsSection } from "@/components/applications/documents-section";
import { RoundsSection } from "@/components/applications/rounds-section";
import { SessionsSection } from "@/components/sessions/sessions-section";

// Logging a real-round outcome triggers background brain regeneration (an AI
// call) via after(); give the route headroom beyond the default timeout.
export const maxDuration = 300;

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
      : "Interview",
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
  const sessions = await getSessionsForApplication(id);

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-col gap-5">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Interviews
        </Link>

        <ApplicationOverview application={application} />
      </div>

      <DocumentsSection applicationId={application.id} documents={documents} />
      <RoundsSection applicationId={application.id} rounds={rounds} />
      <SessionsSection
        applicationId={application.id}
        isArchived={application.is_archived}
        rounds={rounds}
        sessions={sessions}
      />
    </div>
  );
}
