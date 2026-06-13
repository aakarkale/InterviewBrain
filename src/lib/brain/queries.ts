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

// For each active insight, the distinct companies its evidence touches.
// An insight spanning ≥2 companies is "cross-application" — the product's
// aha, and what the brain view celebrates the first time it appears.
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

  const ids = {
    session: new Set<string>(),
    round: new Set<string>(),
    document: new Set<string>(),
    application: new Set<string>(),
  };
  for (const ins of insights) {
    for (const ref of insightEvidence(ins as Insight)) {
      ids[ref.source_type as keyof typeof ids]?.add(ref.source_id);
    }
  }

  // Resolve every evidence source to its application's company name. Sessions,
  // rounds, and documents reach it through their application_id FK.
  const company = new Map<string, string>(); // `${type}:${id}` -> company
  type Embedded = { id: string; applications: { company_name: string } | null };
  const viaApplication: {
    type: "session" | "round" | "document";
    table: "sessions" | "rounds" | "documents";
  }[] = [
    { type: "session", table: "sessions" },
    { type: "round", table: "rounds" },
    { type: "document", table: "documents" },
  ];

  await Promise.all([
    ...viaApplication.map(async ({ type, table }) => {
      if (!ids[type].size) return;
      const { data } = await supabase
        .from(table)
        .select("id, applications(company_name)")
        .in("id", [...ids[type]]);
      for (const row of (data ?? []) as unknown as Embedded[]) {
        if (row.applications?.company_name) {
          company.set(`${type}:${row.id}`, row.applications.company_name);
        }
      }
    }),
    (async () => {
      if (!ids.application.size) return;
      const { data } = await supabase
        .from("applications")
        .select("id, company_name")
        .in("id", [...ids.application]);
      for (const a of data ?? []) {
        company.set(`application:${a.id}`, a.company_name);
      }
    })(),
  ]);

  const result: Record<string, string[]> = {};
  for (const ins of insights) {
    const companies = new Set<string>();
    for (const ref of insightEvidence(ins as Insight)) {
      const name = company.get(`${ref.source_type}:${ref.source_id}`);
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
