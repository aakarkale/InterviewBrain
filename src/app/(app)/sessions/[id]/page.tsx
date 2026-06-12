import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getSessionDetail } from "@/lib/sessions/queries";
import { parseTranscript } from "@/lib/sessions/constants";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import type { RubricScores } from "@/lib/ai/scorer";
import { InterviewChat } from "@/components/sessions/interview-chat";
import { SessionFeedback } from "@/components/sessions/session-feedback";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Interview session" };

// completeSession scores the transcript inline and rescoreSession re-scores;
// both are AI calls that can run tens of seconds. Lift the server-action
// timeout for this page's actions (the deploy platform caps this to its own
// maximum).
export const maxDuration = 300;

const interviewLabel = (value: string) =>
  INTERVIEW_TYPES.find((t) => t.value === value)?.label ?? value;

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) notFound();

  const { session, application, round } = detail;
  const transcript = parseTranscript(session.transcript);

  if (session.status === "completed") {
    const supabase = await createClient();
    const { data: competencies } = await supabase
      .from("competencies")
      .select("id, name")
      .eq("interview_type", session.interview_type);

    return (
      <SessionFeedback
        sessionId={session.id}
        applicationId={application.id}
        companyName={application.company_name}
        roleTitle={application.role_title}
        interviewLabel={interviewLabel(session.interview_type)}
        summary={session.feedback_summary}
        rubricScores={(session.rubric_scores as RubricScores) ?? {}}
        competencies={competencies ?? []}
        transcript={transcript}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/applications/${application.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {application.company_name}
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {application.company_name} mock
        </h1>
        <Badge variant="secondary">{interviewLabel(session.interview_type)}</Badge>
        {round ? (
          <Badge variant="outline">
            Round {round.round_number} · {round.round_type.replace("_", " ")}
          </Badge>
        ) : null}
      </div>

      <InterviewChat sessionId={session.id} initialMessages={transcript} />
    </div>
  );
}
