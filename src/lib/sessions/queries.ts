import { createClient } from "@/lib/db/server";
import type { Tables } from "@/lib/db/database.types";
import type { Company, Interview, Role, Round } from "@/lib/vault/types";

export type Session = Tables<"sessions">;

export type SessionDetail = {
  session: Session;
  interview: Interview;
  role: Role;
  company: Company;
  round: Round | null;
};

// RLS scopes every table to the authenticated owner, so none of these filter on
// user_id explicitly.

export async function getSessionDetail(
  id: string
): Promise<SessionDetail | null> {
  const db = await createClient();

  const { data: session, error } = await db
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!session || !session.interview_id) return null;

  const { data: interview } = await db
    .from("interviews")
    .select("*")
    .eq("id", session.interview_id)
    .maybeSingle();
  if (!interview) return null;

  const { data: role } = await db
    .from("roles")
    .select("*")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return null;

  const [{ data: company }, { data: round }] = await Promise.all([
    db.from("companies").select("*").eq("id", role.company_id).maybeSingle(),
    session.round_id
      ? db.from("rounds").select("*").eq("id", session.round_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!company) return null;

  return { session, interview, role, company, round: round ?? null };
}

export async function getSessionsForInterview(
  interviewId: string
): Promise<Session[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("sessions")
    .select("*")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type RecentSession = Session & {
  interviews: {
    id: string;
    role_id: string;
    roles: {
      id: string;
      title: string;
      company_id: string;
      companies: { id: string; name: string } | null;
    } | null;
  } | null;
};

export async function getRecentSessions(limit = 5): Promise<RecentSession[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("sessions")
    .select(
      "*, interviews(id, role_id, roles(id, title, company_id, companies(id, name)))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as RecentSession[]) ?? [];
}

// Sessions created since the first of the current calendar month (UTC), for the
// per-month free cap.
export async function getMonthlySessionCount(): Promise<number> {
  const db = await createClient();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const { count, error } = await db
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  if (error) throw error;
  return count ?? 0;
}
