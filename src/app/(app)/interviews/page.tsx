import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MessagesSquare } from "lucide-react";

import { getCompaniesOverview } from "@/lib/vault/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Interviews" };

const count = (rel: { count: number }[]) => rel[0]?.count ?? 0;

export default async function InterviewsPage() {
  const companies = await getCompaniesOverview();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Interviews"
        description="Pick a company, then a role, to see its interviews, rounds, and practice sessions."
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No interviews yet"
          description="Create a vault and a role first — then start an interview for it."
          action={
            <Button asChild size="sm">
              <Link href="/vault/new">Go to Company Vault</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => {
            const roles = count(company.roles);
            return (
              <Link
                key={company.id}
                href={`/interviews/${company.id}`}
                className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-md border bg-surface-2 text-sm font-semibold text-foreground"
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
          })}
        </div>
      )}
    </div>
  );
}
