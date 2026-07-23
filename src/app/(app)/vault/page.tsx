import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Plus, ShieldCheck } from "lucide-react";

import {
  getCompaniesOverview,
  type CompanyOverview,
} from "@/lib/vault/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Company Vault" };

const count = (rel: { count: number }[]) => rel[0]?.count ?? 0;

export default async function VaultPage() {
  const companies = await getCompaniesOverview();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Company Vault"
        description="Everything you know about each company and its roles — docs, research, and AI insights."
        actions={
          <Button asChild>
            <Link href="/vault/new">
              <Plus /> New vault
            </Link>
          </Button>
        }
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No vaults yet"
          description="Create a vault for a company you're interviewing at, then add the roles you're going for."
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
            <CompanyTile key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyTile({ company }: { company: CompanyOverview }) {
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
      {company.h1b_tracking_enabled ? (
        <span className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> H-1B tracked
        </span>
      ) : null}
    </Link>
  );
}
