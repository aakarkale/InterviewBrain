import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { Company, Interview, Role, Round } from "@/lib/vault/types";

export type Session = Tables<"sessions">;

// RLS scopes every table to the owner (same contract as the vault queries).

export async function getInterview(id: string): Promise<{
  interview: Interview;
  role: Role;
  company: Company;
  rounds: Round[];
  sessions: Session[];
} | null> {
  const supabase = await createClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!interview) return null;

  const { data: role } = await supabase
    .from("roles")
    .select("*")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return null;

  const [{ data: company }, { data: rounds }, { data: sessions }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", role.company_id).maybeSingle(),
      supabase
        .from("rounds")
        .select("*")
        .eq("interview_id", id)
        .order("round_number", { ascending: true }),
      supabase
        .from("sessions")
        .select("*")
        .eq("interview_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!company) return null;

  return {
    interview,
    role,
    company,
    rounds: rounds ?? [],
    sessions: sessions ?? [],
  };
}

export async function getRound(id: string): Promise<{
  round: Round;
  interview: Interview;
  role: Role;
  company: Company;
  // Earlier rounds in the same interview, for round-to-round context.
  priorRounds: Round[];
} | null> {
  const supabase = await createClient();

  const { data: round, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!round || !round.interview_id) return null;

  const { data: interview } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", round.interview_id)
    .maybeSingle();
  if (!interview) return null;

  const { data: role } = await supabase
    .from("roles")
    .select("*")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return null;

  const [{ data: company }, { data: priorRounds }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", role.company_id).maybeSingle(),
    supabase
      .from("rounds")
      .select("*")
      .eq("interview_id", round.interview_id)
      .lt("round_number", round.round_number)
      .order("round_number", { ascending: true }),
  ]);

  if (!company) return null;

  return { round, interview, role, company, priorRounds: priorRounds ?? [] };
}

// Interview label + role/company for breadcrumbs / metadata.
export async function getInterviewCrumb(id: string): Promise<{
  interview: Pick<Interview, "id" | "label" | "role_id">;
  role: Pick<Role, "id" | "title" | "company_id">;
  company: Pick<Company, "id" | "name">;
} | null> {
  const supabase = await createClient();
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, label, role_id")
    .eq("id", id)
    .maybeSingle();
  if (!interview) return null;
  const { data: role } = await supabase
    .from("roles")
    .select("id, title, company_id")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return null;
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", role.company_id)
    .maybeSingle();
  if (!company) return null;
  return { interview, role, company };
}
