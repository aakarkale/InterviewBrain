import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { getCompany, getCompanyName, type RoleOverview } from "@/lib/vault/queries";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { FileText } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companyId: string }>;
}): Promise<Metadata> {
  const { companyId } = await params;
  const company = await getCompanyName(companyId);
  return { title: company ? `${company.name} · Interviews` : "Interviews" };
}

const num = (rel: { count: number }[]) => rel[0]?.count ?? 0;

export default async function CompanyInterviewsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const data = await getCompany(companyId);
  if (!data) notFound();
  const { company, roles } = data;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-5">
        <Link
          href="/interviews"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Interviews
        </Link>
        <PageHeader title={company.name} description="Pick a role to see its interviews." />
      </div>

      {roles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No roles yet"
          description="Add a role in the Company Vault before starting interviews."
          action={
            <Button asChild size="sm">
              <Link href={`/vault/${company.id}/roles/new`}>Add a role</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role: RoleOverview) => (
            <Link
              key={role.id}
              href={`/interviews/${company.id}/roles/${role.id}`}
              className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium">{role.title}</span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-text-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  aria-hidden
                />
              </div>
              <span className="font-mono text-xs text-text-3">
                {num(role.interviews)}{" "}
                {num(role.interviews) === 1 ? "interview" : "interviews"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
