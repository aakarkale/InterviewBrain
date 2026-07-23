import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getInterview } from "@/lib/interviews/queries";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { RoundsList } from "@/components/interviews/rounds-list";
import { InterviewSettings } from "@/components/interviews/interview-settings";
import { SessionsSection } from "@/components/sessions/sessions-section";

// Starting a session is a redirect; completing one (from the session page)
// triggers brain regen. Keep headroom for the server actions on this route.
export const maxDuration = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}): Promise<Metadata> {
  const { interviewId } = await params;
  const data = await getInterview(interviewId);
  return {
    title: data ? `${data.interview.label} · ${data.company.name}` : "Interview",
  };
}

export default async function InterviewPage({
  params,
}: {
  params: Promise<{
    companyId: string;
    roleId: string;
    interviewId: string;
  }>;
}) {
  const { interviewId } = await params;
  const data = await getInterview(interviewId);
  if (!data) notFound();
  const { interview, role, company, rounds, sessions } = data;

  const rolePath = `/interviews/${company.id}/roles/${role.id}`;
  const basePath = `${rolePath}/${interview.id}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <Link
          href={rolePath}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {role.title}
        </Link>
        <PageHeader
          title={interview.label}
          description={`${company.name} · ${role.title}`}
          actions={<Badge variant="secondary">{interview.status}</Badge>}
        />
      </div>

      <RoundsList interviewId={interview.id} basePath={basePath} rounds={rounds} />

      <SessionsSection
        interviewId={interview.id}
        isArchived={role.is_archived}
        rounds={rounds}
        sessions={sessions}
      />

      <InterviewSettings interview={interview} backHref={rolePath} />
    </div>
  );
}
