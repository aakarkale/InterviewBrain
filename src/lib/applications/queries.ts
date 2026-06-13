import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Application = Tables<"applications">;
export type Round = Tables<"rounds">;
export type DocumentRow = Tables<"documents">;

// RLS scopes every table to the authenticated owner, so these reads return
// only the current user's rows without an explicit user_id filter.

export async function getApplications(): Promise<Application[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type ApplicationOverviewRow = Application & {
  rounds: { count: number }[];
  documents: { count: number }[];
  sessions: { count: number }[];
};

// Applications with per-vault activity counts for the dashboard cards.
export async function getApplicationsOverview(): Promise<
  ApplicationOverviewRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("*, rounds(count), documents(count), sessions(count)")
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ApplicationOverviewRow[];
}

export async function getApplication(id: string): Promise<{
  application: Application;
  rounds: Round[];
  documents: DocumentRow[];
} | null> {
  const supabase = await createClient();

  const { data: application, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!application) return null;

  const [{ data: rounds }, { data: documents }] = await Promise.all([
    supabase
      .from("rounds")
      .select("*")
      .eq("application_id", id)
      .order("round_number", { ascending: true }),
    supabase
      .from("documents")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    application,
    rounds: rounds ?? [],
    documents: documents ?? [],
  };
}

export async function getApplicationTitle(
  id: string
): Promise<Pick<Application, "company_name" | "role_title"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("company_name, role_title")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getActiveApplicationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false);

  if (error) throw error;
  return count ?? 0;
}
