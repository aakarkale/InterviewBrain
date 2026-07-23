import { createClient } from "@/lib/supabase/server";
import { insightEvidence, type Insight } from "./types";

// RLS scopes insights to the owner.

export async function getInsights(): Promise<Insight[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .eq("status", "active")
    .order("type", { ascending: true })
    .order("confidence", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// For each active insight, the distinct companies its evidence touches. An
// insight spanning ≥2 companies is "cross-company" — the product's aha, and
// what the brain view celebrates the first time it appears.
export async function getCompaniesByInsight(): Promise<
  Record<string, string[]>
> {
  const supabase = await createClient();
  const { data: insights, error } = await supabase
    .from("insights")
    .select("id, evidence")
    .eq("status", "active");
  if (error) throw error;
  if (!insights?.length) return {};

  const ids: Record<string, Set<string>> = {
    session: new Set(),
    round: new Set(),
    document: new Set(),
    company: new Set(),
    role: new Set(),
  };
  for (const ins of insights) {
    for (const ref of insightEvidence(ins as Insight)) {
      // Legacy "application" refs were remapped to "company" at backfill.
      const key = ref.source_type === "application" ? "company" : ref.source_type;
      ids[key]?.add(ref.source_id);
    }
  }

  // Resolve every evidence source to its company name. Sessions and rounds reach
  // it through interview → role → company; documents through role → company.
  const company = new Map<string, string>(); // `${type}:${id}` -> company name
  type ViaInterview = {
    id: string;
    interviews: { roles: { companies: { name: string } | null } | null } | null;
  };
  type ViaRole = {
    id: string;
    roles: { companies: { name: string } | null } | null;
  };

  await Promise.all([
    (async () => {
      if (!ids.session.size) return;
      const { data } = await supabase
        .from("sessions")
        .select("id, interviews(roles(companies(name)))")
        .in("id", [...ids.session]);
      for (const row of (data ?? []) as unknown as ViaInterview[]) {
        const name = row.interviews?.roles?.companies?.name;
        if (name) company.set(`session:${row.id}`, name);
      }
    })(),
    (async () => {
      if (!ids.round.size) return;
      const { data } = await supabase
        .from("rounds")
        .select("id, interviews(roles(companies(name)))")
        .in("id", [...ids.round]);
      for (const row of (data ?? []) as unknown as ViaInterview[]) {
        const name = row.interviews?.roles?.companies?.name;
        if (name) company.set(`round:${row.id}`, name);
      }
    })(),
    (async () => {
      if (!ids.document.size) return;
      const { data } = await supabase
        .from("documents")
        .select("id, roles(companies(name))")
        .in("id", [...ids.document]);
      for (const row of (data ?? []) as unknown as ViaRole[]) {
        const name = row.roles?.companies?.name;
        if (name) company.set(`document:${row.id}`, name);
      }
    })(),
    (async () => {
      if (!ids.company.size) return;
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", [...ids.company]);
      for (const c of data ?? []) company.set(`company:${c.id}`, c.name);
    })(),
    (async () => {
      if (!ids.role.size) return;
      const { data } = await supabase
        .from("roles")
        .select("id, companies(name)")
        .in("id", [...ids.role]);
      for (const r of (data ?? []) as unknown as {
        id: string;
        companies: { name: string } | null;
      }[]) {
        if (r.companies?.name) company.set(`role:${r.id}`, r.companies.name);
      }
    })(),
  ]);

  const result: Record<string, string[]> = {};
  for (const ins of insights) {
    const companies = new Set<string>();
    for (const ref of insightEvidence(ins as Insight)) {
      const key = ref.source_type === "application" ? "company" : ref.source_type;
      const name = company.get(`${key}:${ref.source_id}`);
      if (name) companies.add(name);
    }
    if (companies.size) result[ins.id] = [...companies].sort();
  }
  return result;
}

export async function getActiveInsightCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("insights")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  if (error) throw error;
  return count ?? 0;
}

// Highest-confidence weakness or pattern for the dashboard's "top insight"
// card. Strengths are reassuring but the product's job is to surface what to
// fix, so weaknesses and cross-company patterns rank first.
export async function getTopInsight(): Promise<Insight | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .eq("status", "active")
    .in("type", ["weakness", "pattern"])
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
