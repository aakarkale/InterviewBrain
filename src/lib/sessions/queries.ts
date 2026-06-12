import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { Application, Round } from "@/lib/applications/queries";

export type Session = Tables<"sessions">;

export type SessionDetail = {
  session: Session;
  application: Application;
  round: Round | null;
};

// RLS scopes every table to the authenticated owner (same contract as the
// application queries), so none of these filter on user_id explicitly.

export async function getSessionDetail(
  id: string
): Promise<SessionDetail | null> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!session) return null;

  const [{ data: application }, { data: round }] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("id", session.application_id)
      .maybeSingle(),
    session.round_id
      ? supabase.from("rounds").select("*").eq("id", session.round_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!application) return null;

  return { session, application, round: round ?? null };
}

export async function getSessionsForApplication(
  applicationId: string
): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type RecentSession = Session & {
  applications: Pick<Application, "company_name" | "role_title"> | null;
};

export async function getRecentSessions(limit = 5): Promise<RecentSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*, applications(company_name, role_title)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as RecentSession[]) ?? [];
}

// Sessions created since the first of the current calendar month (UTC),
// for the 10-per-month free cap.
export async function getMonthlySessionCount(): Promise<number> {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const { count, error } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  if (error) throw error;
  return count ?? 0;
}
