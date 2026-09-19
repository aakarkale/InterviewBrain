import { createClient } from "@/lib/db/server";
import type { Company, DocumentRow, Interview, Role } from "./types";

// RLS scopes every table to the authenticated owner, so these reads return only
// the current user's rows without an explicit user_id filter.

export type CompanyOverview = Company & {
  roles: { count: number }[];
};

// Company tiles with a per-vault role count (Company Vault tab + Interviews tab).
export async function getCompaniesOverview(): Promise<CompanyOverview[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("companies")
    .select("*, roles(count)")
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CompanyOverview[];
}

export type RoleOverview = Role & {
  documents: { count: number }[];
  interviews: { count: number }[];
};

export async function getCompany(id: string): Promise<{
  company: Company;
  roles: RoleOverview[];
} | null> {
  const db = await createClient();

  const { data: company, error } = await db
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!company) return null;

  const { data: roles } = await db
    .from("roles")
    .select("*, documents(count), interviews(count)")
    .eq("company_id", id)
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: false });

  return { company, roles: (roles ?? []) as RoleOverview[] };
}

export type InterviewOverview = Interview & {
  rounds: { count: number }[];
  sessions: { count: number }[];
};

export async function getRole(id: string): Promise<{
  role: Role;
  company: Company;
  documents: DocumentRow[];
  interviews: InterviewOverview[];
} | null> {
  const db = await createClient();

  const { data: role, error } = await db
    .from("roles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!role) return null;

  const [{ data: company }, { data: documents }, { data: interviews }] =
    await Promise.all([
      db.from("companies").select("*").eq("id", role.company_id).maybeSingle(),
      db
        .from("documents")
        .select("*")
        .eq("role_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("interviews")
        .select("*, rounds(count), sessions(count)")
        .eq("role_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!company) return null;

  return {
    role,
    company,
    documents: documents ?? [],
    interviews: (interviews ?? []) as InterviewOverview[],
  };
}

export async function getActiveRoleCount(): Promise<number> {
  const db = await createClient();
  const { count, error } = await db
    .from("roles")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false);

  if (error) throw error;
  return count ?? 0;
}

export async function getCompanyName(
  id: string
): Promise<Pick<Company, "name"> | null> {
  const db = await createClient();
  const { data } = await db
    .from("companies")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// Role title + company name for breadcrumbs / page metadata.
export async function getRoleCrumb(id: string): Promise<{
  role: Pick<Role, "id" | "title" | "company_id">;
  company: Pick<Company, "id" | "name">;
} | null> {
  const db = await createClient();
  const { data: role } = await db
    .from("roles")
    .select("id, title, company_id")
    .eq("id", id)
    .maybeSingle();
  if (!role) return null;
  const { data: company } = await db
    .from("companies")
    .select("id, name")
    .eq("id", role.company_id)
    .maybeSingle();
  if (!company) return null;
  return { role, company };
}
