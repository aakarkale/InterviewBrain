import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  MessageSquareText,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveRoleCount,
  getCompaniesOverview,
  type CompanyOverview,
} from "@/lib/vault/queries";
import {
  getMonthlySessionCount,
  getRecentSessions,
  type RecentSession,
} from "@/lib/sessions/queries";
import { getActiveInsightCount, getTopInsight } from "@/lib/brain/queries";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import { MAX_ACTIVE_ROLES } from "@/lib/vault/constants";
import { MAX_SESSIONS_PER_MONTH } from "@/lib/sessions/constants";
import type { Insight } from "@/lib/brain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Dashboard" };

const interviewLabel = (value: string) =>
  INTERVIEW_TYPES.find((t) => t.value === value)?.label ?? value;
const count = (rel: { count: number }[]) => rel[0]?.count ?? 0;

function sessionAverage(session: RecentSession): number | null {
  const scores = session.rubric_scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return null;
  const values = Object.values(scores as Record<string, { score?: number }>)
    .map((v) => v?.score)
    .filter((s): s is number => typeof s === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sessionHref(s: RecentSession): string {
  return `/sessions/${s.id}`;
}

function sessionCompany(s: RecentSession): string {
  return s.interviews?.roles?.companies?.name ?? "Interview";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("users").select("full_name").eq("id", user.id).single()
    : { data: null };

  const firstName = profile?.full_name?.split(/\s+/)[0];

  const [
    companies,
    activeRoles,
    recentSessions,
    topInsight,
    monthlySessions,
    insightCount,
  ] = await Promise.all([
    getCompaniesOverview(),
    getActiveRoleCount(),
    getRecentSessions(5),
    getTopInsight(),
    getMonthlySessionCount(),
    getActiveInsightCount(),
  ]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Your vaults, practice sessions, and what the brain is noticing."
        actions={
          <Button asChild>
            <Link href="/vault/new">
              <Plus /> New vault
            </Link>
          </Button>
        }
      />

      <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border bg-surface-0/50">
        <Stat label="Active roles" value={activeRoles} max={MAX_ACTIVE_ROLES} />
        <Stat
          label="Sessions this month"
          value={monthlySessions}
          max={MAX_SESSIONS_PER_MONTH}
        />
        <Stat label="Active insights" value={insightCount} />
      </dl>

      <section className="flex flex-col gap-3" aria-label="Company vaults">
        {companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No vaults yet"
            description="Create your first vault — a company you're interviewing at — then add its roles."
            action={
              <Button asChild size="sm">
                <Link href="/vault/new">
                  <Plus /> New vault
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section
          aria-label="Recent sessions"
          className="flex flex-col overflow-hidden rounded-lg border bg-card"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <h2 className="text-micro text-muted-foreground">Recent sessions</h2>
            <MessageSquareText className="size-3.5 text-text-3" aria-hidden />
          </div>
          {recentSessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Run your first mock from an interview — feedback lands here.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {recentSessions.map((s) => {
                const avg = sessionAverage(s);
                const done = s.status === "completed";
                return (
                  <li key={s.id}>
                    <Link
                      href={sessionHref(s)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2/50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {done ? (
                          <CheckCircle2
                            className="size-3.5 shrink-0 text-success"
                            aria-hidden
                          />
                        ) : (
                          <MessageSquareText
                            className="size-3.5 shrink-0 text-primary"
                            aria-hidden
                          />
                        )}
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {sessionCompany(s)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {interviewLabel(s.interview_type)}
                            {done ? "" : " · in progress"}
                          </span>
                        </div>
                      </div>
                      {done && avg !== null ? (
                        <span
                          className={`font-mono text-xs tabular-nums ${
                            avg <= 2 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {avg.toFixed(1)}/5
                        </span>
                      ) : !done ? (
                        <Badge variant="warning">Resume</Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <TopInsightCard insight={topInsight} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg leading-none font-medium tabular-nums">
        {value}
        {max !== undefined ? <span className="text-text-3"> / {max}</span> : null}
      </dd>
    </div>
  );
}

function TopInsightCard({ insight }: { insight: Insight | null }) {
  const isWeakness = insight?.type === "weakness";
  const Icon = isWeakness ? AlertTriangle : Sparkles;
  return (
    <section
      aria-label="Top insight"
      className="flex flex-col overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-micro text-muted-foreground">Top insight</h2>
        <TrendingUp className="size-3.5 text-text-3" aria-hidden />
      </div>
      {insight ? (
        <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            <Badge variant={isWeakness ? "destructive" : "warning"}>
              <Icon /> {isWeakness ? "Weakness" : "Pattern"}
            </Badge>
            <span className="font-mono text-xs tabular-nums text-text-3">
              {Math.round(insight.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-sm leading-relaxed">{insight.summary}</p>
          <Link
            href="/brain"
            className="mt-auto inline-flex w-fit items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
          >
            See all insights <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Insights appear once the brain has a few sessions to learn from.
        </p>
      )}
    </section>
  );
}

function CompanyCard({ company }: { company: CompanyOverview }) {
  const roles = count(company.roles);
  return (
    <Link
      href={`/vault/${company.id}`}
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className={`flex size-8 items-center justify-center rounded-md border text-sm font-semibold ${
            company.is_archived
              ? "bg-surface-1 text-text-3"
              : "bg-surface-2 text-foreground"
          }`}
        >
          {company.name.slice(0, 1).toUpperCase()}
        </span>
        {company.is_archived ? (
          <Badge variant="outline">Archived</Badge>
        ) : (
          <ArrowUpRight
            className="size-4 text-text-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            aria-hidden
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{company.name}</span>
        <span className="font-mono text-xs text-text-3">
          {roles} {roles === 1 ? "role" : "roles"}
        </span>
      </div>
    </Link>
  );
}
