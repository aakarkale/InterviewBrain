import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCompanyName } from "@/lib/vault/queries";
import { RoleForm } from "@/components/vault/role-form";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "New role" };

export default async function NewRolePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyName(companyId);
  if (!company) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href={`/vault/${companyId}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {company.name}
      </Link>
      <PageHeader
        title="New role"
        description={`Add a role you're interviewing for at ${company.name}.`}
      />
      <RoleForm companyId={companyId} />
    </div>
  );
}
