import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { getRole, getRoleCrumb } from "@/lib/vault/queries";
import { setRoleArchived, deleteRole } from "@/lib/vault/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { RoleForm } from "@/components/vault/role-form";
import { RoundPlanEditor } from "@/components/vault/round-plan-editor";
import { DocumentsSection } from "@/components/vault/documents-section";
import { RoleAlignmentPanel } from "@/components/vault/role-alignment-panel";
import { LinkedinUpload } from "@/components/vault/linkedin-upload";

// Role-alignment generation runs an AI pass (can take tens of seconds).
export const maxDuration = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companyId: string; roleId: string }>;
}): Promise<Metadata> {
  const { roleId } = await params;
  const crumb = await getRoleCrumb(roleId);
  return {
    title: crumb ? `${crumb.role.title} · ${crumb.company.name}` : "Role",
  };
}

export default async function RolePage({
  params,
}: {
  params: Promise<{ companyId: string; roleId: string }>;
}) {
  const { roleId } = await params;
  const data = await getRole(roleId);
  if (!data) notFound();
  const { role, company, documents } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <Link
          href={`/vault/${company.id}`}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {company.name}
        </Link>
        <PageHeader
          title={role.title}
          description={
            [role.hiring_manager, role.team_name].filter(Boolean).join(" · ") ||
            `Role at ${company.name}`
          }
          actions={
            <Button asChild variant="outline">
              <Link href={`/interviews/${company.id}/roles/${role.id}`}>
                Interviews <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        {role.is_archived ? <Badge variant="outline">Archived</Badge> : null}
      </div>

      <RoleAlignmentPanel role={role} />

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Round plan"
          description="Name the rounds you expect. Each new interview for this role starts from this plan."
        />
        <RoundPlanEditor role={role} />
      </section>

      <DocumentsSection roleId={role.id} documents={documents} />

      <details className="group rounded-lg border bg-surface-0/40">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Edit role (JD, resume, LinkedIn, research)
        </summary>
        <div className="flex flex-col gap-5 border-t px-4 py-4">
          <LinkedinUpload roleId={role.id} companyId={company.id} />
          <div className="border-t pt-5">
            <RoleForm companyId={company.id} role={role} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <form action={setRoleArchived}>
              <input type="hidden" name="id" value={role.id} />
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="archived" value={String(!role.is_archived)} />
              <Button type="submit" variant="outline" size="sm">
                {role.is_archived ? "Unarchive" : "Archive"} role
              </Button>
            </form>
            <form action={deleteRole}>
              <input type="hidden" name="id" value={role.id} />
              <input type="hidden" name="company_id" value={company.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                Delete role
              </Button>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}
