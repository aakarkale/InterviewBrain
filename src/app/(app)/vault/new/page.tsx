import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CompanyForm } from "@/components/vault/company-form";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "New vault" };

export default function NewVaultPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/vault"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Company Vault
      </Link>
      <PageHeader
        title="New vault"
        description="Start with the company. You'll add roles and research next."
      />
      <CompanyForm />
    </div>
  );
}
