import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Lightbulb,
  MessageSquareText,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getApplications, type Application } from "@/lib/applications/queries";
import {
  getRecentSessions,
  type RecentSession,
} from "@/lib/sessions/queries";
import { getTopInsight } from "@/lib/brain/queries";
import { MAX_ACTIVE_APPLICATIONS } from "@/lib/applications/constants";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import type { Insight } from "@/lib/brain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

const interviewLabel = (value: string) =>
  INTERVIEW_TYPES.find((t) => t.value === value)?.label ?? value;

function sessionAverage(session: RecentSession): number | null {
  const scores = session.rubric_scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return null;
  const values = Object.values(scores as Record<string, { score?: number }>)
    .map((v) => v?.score)
    .filter((s): s is number => typeof s === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .single()
    : { data: null };

  const firstName = profile?.full_name?.split(/\s+/)[0];

  const [applications, recentSessions, topInsight] = await Promise.all([
    getApplications(),
    getRecentSessions(5),
    getTopInsight(),
  ]);

  const active = applications.filter((a) => !a.is_archived);
  const archived = applications.filter((a) => a.is_archived);
  const atCap = active.length >= MAX_ACTIVE_APPLICATIONS;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your applications, sessions, and insights live here.
          </p>
        </div>
        {atCap ? (
          <Button
            variant="outline"
            disabled
            title={`Free plan is capped at ${MAX_ACTIVE_APPLICATIONS} active applications`}
          >
            <Plus /> New application
          </Button>
        ) : (
          <Button asChild>
            <Link href="/applications/new">
              <Plus /> New application
            </Link>
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">Applications</h2>
          <span className="text-sm text-muted-foreground">
            {active.length} of {MAX_ACTIVE_APPLICATIONS} active
          </span>
        </div>

        {applications.length === 0 ? (
          <Card>
            <CardHeader>
              <FolderOpen className="size-5 text-primary" aria-hidden />
              <CardTitle>No applications yet</CardTitle>
              <CardDescription>
                Create your first vault — paste a JD and your resume, and
                you&apos;re ready to practice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/applications/new">
                  <Plus /> New application
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...active, ...archived].map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <MessageSquareText className="size-5 text-primary" aria-hidden />
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>
              Mock interviews built from your actual materials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Run your first mock from an application to see sessions here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentSessions.map((s) => {
                  const avg = sessionAverage(s);
                  const done = s.status === "completed";
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/sessions/${s.id}`}
                        className="group flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-center gap-2.5">
                          {done ? (
                            <CheckCircle2
                              className="size-4 text-success"
                              aria-hidden
                            />
                          ) : (
                            <MessageSquareText
                              className="size-4 text-primary"
                              aria-hidden
                            />
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {s.applications?.company_name ?? "Application"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {interviewLabel(s.interview_type)}
                              {done ? "" : " · in progress"}
                            </span>
                          </div>
                        </div>
                        {done && avg !== null ? (
                          <Badge variant={avg <= 2 ? "destructive" : "secondary"}>
                            {avg.toFixed(1)}/5
                          </Badge>
                        ) : !done ? (
                          <Badge variant="warning">Resume</Badge>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <TopInsightCard insight={topInsight} />
      </div>
    </div>
  );
}

function TopInsightCard({ insight }: { insight: Insight | null }) {
  const Icon = insight?.type === "weakness" ? AlertTriangle : Sparkles;
  return (
    <Card>
      <CardHeader>
        <Lightbulb className="size-5 text-primary" aria-hidden />
        <CardTitle>Top insight</CardTitle>
        <CardDescription>
          What the brain notices across your applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insight ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
              />
              <p className="text-sm leading-relaxed">{insight.summary}</p>
            </div>
            <Link
              href="/brain"
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
            >
              <TrendingUp className="size-4" /> See all insights
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Insights appear once the brain has a few sessions to learn from.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  return (
    <Link href={`/applications/${app.id}`} className="group block">
      <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{app.company_name}</CardTitle>
            {app.is_archived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : null}
          </div>
          <CardDescription className="truncate">
            {app.role_title}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
