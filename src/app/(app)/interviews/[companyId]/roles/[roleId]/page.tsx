import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { getRole, getRoleCrumb, type InterviewOverview } from "@/lib/vault/queries";
import { roundPlan } from "@/lib/vault/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { NewInterview } from "@/components/interviews/new-interview";
import { MessagesSquare } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companyId: string; roleId: string }>;
}): Promise<Metadata> {
  const { roleId } = await params;
  const crumb = await getRoleCrumb(roleId);
  return {
    title: crumb ? `Interviews · ${crumb.role.title}` : "Interviews",
  };
}

const num = (rel: { count: number }[]) => rel[0]?.count ?? 0;

const statusVariant = (s: string) =>
  s === "completed" ? "secondary" : s === "archived" ? "outline" : "default";

export default async function RoleInterviewsPage({
  params,
}: {
  params: Promise<{ companyId: string; roleId: string }>;
}) {
  const { roleId } = await params;
  const data = await getRole(roleId);
  if (!data) notFound();
  const { role, company, interviews } = data;
  const planLength = roundPlan(role).length;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-5">
        <Link
          href={`/interviews/${company.id}`}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {company.name}
        </Link>
        <PageHeader
          title={role.title}
          description="Each interview is one run at this role. Start a new one for each attempt over time."
          actions={<NewInterview roleId={role.id} hasPlan={planLength > 0} />}
        />
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No interviews yet"
          description={
            planLength > 0
              ? `Start an interview — its ${planLength} planned rounds are added automatically.`
              : "Start an interview, then add its rounds."
          }
        />
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
          {interviews.map((interview: InterviewOverview) => (
            <li key={interview.id}>
              <Link
                href={`/interviews/${company.id}/roles/${role.id}/${interview.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/50"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {interview.label}
                    </span>
                    <Badge variant={statusVariant(interview.status)}>
                      {interview.status}
                    </Badge>
                  </div>
                  <span className="font-mono text-xs text-text-3">
                    {num(interview.rounds)}{" "}
                    {num(interview.rounds) === 1 ? "round" : "rounds"} ·{" "}
                    {num(interview.sessions)}{" "}
                    {num(interview.sessions) === 1 ? "mock" : "mocks"}
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
