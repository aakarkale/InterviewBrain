import { createClient } from "@/lib/supabase/server";
import type { Insight } from "./types";

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
