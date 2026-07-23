import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, Plus, ShieldCheck } from "lucide-react";

import { getCompany, getCompanyName, type RoleOverview } from "@/lib/vault/queries";
import { roundPlan } from "@/lib/vault/types";
import { setCompanyArchived, deleteCompany } from "@/lib/vault/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { CompanyForm } from "@/components/vault/company-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companyId: string }>;
}): Promise<Metadata> {
  const { companyId } = await params;
  const company = await getCompanyName(companyId);
  return { title: company ? `${company.name} · Vault` : "Vault" };
}

const num = (rel: { count: number }[]) => rel[0]?.count ?? 0;

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const data = await getCompany(companyId);
  if (!data) notFound();
  const { company, roles } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <Link
          href="/vault"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Company Vault
        </Link>
        <PageHeader
          title={company.name}
          description="Company research and AI insights live here. Add a role for each job you're going for."
          actions={
            <Button asChild>
              <Link href={`/vault/${company.id}/roles/new`}>
                <Plus /> Add role
              </Link>
            </Button>
          }
        />
        {company.h1b_tracking_enabled ? (
          <span className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> H-1B sponsorship tracked
          </span>
        ) : null}
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Roles" description="Each role has its own JD, resume, round plan, and interviews." />
        {roles.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No roles yet"
            description="Add the first role you're interviewing for at this company."
            action={
              <Button asChild size="sm">
                <Link href={`/vault/${company.id}/roles/new`}>
                  <Plus /> Add role
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <RoleTile key={role.id} companyId={company.id} role={role} />
            ))}
          </div>
        )}
      </section>

      <details className="group rounded-lg border bg-surface-0/40">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Manage vault
        </summary>
        <div className="flex flex-col gap-5 border-t px-4 py-4">
          <CompanyForm company={company} />
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <form action={setCompanyArchived}>
              <input type="hidden" name="id" value={company.id} />
              <input type="hidden" name="archived" value={String(!company.is_archived)} />
              <Button type="submit" variant="outline" size="sm">
                {company.is_archived ? "Unarchive" : "Archive"} vault
              </Button>
            </form>
            <form action={deleteCompany}>
              <input type="hidden" name="id" value={company.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                Delete vault
              </Button>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}

function RoleTile({ companyId, role }: { companyId: string; role: RoleOverview }) {
  const meta = [
    `${roundPlan(role).length} planned`,
    `${num(role.documents)} ${num(role.documents) === 1 ? "doc" : "docs"}`,
    `${num(role.interviews)} ${num(role.interviews) === 1 ? "interview" : "interviews"}`,
  ].join(" · ");
  return (
    <Link
      href={`/vault/${companyId}/roles/${role.id}`}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium">{role.title}</span>
        {role.is_archived ? (
          <Badge variant="outline">Archived</Badge>
        ) : (
          <ArrowUpRight
            className="size-4 shrink-0 text-text-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            aria-hidden
          />
        )}
      </div>
      <span className="font-mono text-xs text-text-3">{meta}</span>
    </Link>
  );
}
