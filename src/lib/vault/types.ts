import type { Tables } from "@/lib/supabase/database.types";

// Client-safe domain types + JSONB helpers for the Company (Vault) -> Role ->
// Interview -> Round hierarchy. No server-only import so UI can use these.

export type Company = Tables<"companies">;
export type Role = Tables<"roles">;
export type Interview = Tables<"interviews">;
export type Round = Tables<"rounds">;
export type DocumentRow = Tables<"documents">;

// ------------------------------------------------------------- round plan

// A role's reusable round plan: an ordered list of {name, type}. Each interview
// snapshots these into its own editable rounds at creation.
export type RoundPlanEntry = { name: string; type: string };

export function roundPlan(role: Pick<Role, "round_plan">): RoundPlanEntry[] {
  if (!Array.isArray(role.round_plan)) return [];
  const out: RoundPlanEntry[] = [];
  for (const raw of role.round_plan as unknown[]) {
    if (raw && typeof raw === "object" && "name" in raw && "type" in raw) {
      const name = String((raw as { name: unknown }).name ?? "").trim();
      const type = String((raw as { type: unknown }).type ?? "other");
      if (name) out.push({ name, type });
    }
  }
  return out;
}

// ------------------------------------------------------ AI insight caches

// A cited source captured from a web-search research pass.
export type InsightSource = { title: string; url: string };

// Cached, web-grounded company insights (companies.insights).
export type CompanyInsightSection = {
  key: string;
  title: string;
  body: string;
  sources: InsightSource[];
};
export type CompanyInsights = {
  sections: CompanyInsightSection[];
  generated_at: string;
};

// Cached role-alignment insights (roles.alignment).
export type RoleAlignment = {
  fit_score: number; // 0–100
  summary: string;
  strengths: string[];
  gaps: string[];
  talking_points: string[];
  sources: InsightSource[];
  generated_at: string;
};

// Cached interview-prep guidance (interviews.prep).
export type InterviewPrep = {
  focus_areas: { title: string; detail: string }[];
  likely_questions: string[];
  tips: string[];
  sources: InsightSource[];
  generated_at: string;
};

// Cached round-to-round coaching (rounds.coaching).
export type RoundCoaching = {
  summary: string;
  what_went_well: string[];
  gaps: string[];
  next_round_focus: string[];
  generated_at: string;
};

// Narrow a stored JSONB cache to a typed shape (server-side re-validation still
// happens in the generators; this is a defensive read for the UI).
export function asCompanyInsights(value: unknown): CompanyInsights | null {
  if (value && typeof value === "object" && Array.isArray((value as CompanyInsights).sections)) {
    return value as CompanyInsights;
  }
  return null;
}

export function asRoleAlignment(value: unknown): RoleAlignment | null {
  if (value && typeof value === "object" && "fit_score" in value) {
    return value as RoleAlignment;
  }
  return null;
}

export function asInterviewPrep(value: unknown): InterviewPrep | null {
  if (value && typeof value === "object" && Array.isArray((value as InterviewPrep).focus_areas)) {
    return value as InterviewPrep;
  }
  return null;
}

export function asRoundCoaching(value: unknown): RoundCoaching | null {
  if (value && typeof value === "object" && "summary" in value && "next_round_focus" in value) {
    return value as RoundCoaching;
  }
  return null;
}
