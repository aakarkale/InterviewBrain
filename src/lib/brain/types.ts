import type { Tables } from "@/lib/supabase/database.types";

// Client-safe types + helpers (no server-only import).

export type Insight = Tables<"insights">;

export type EvidenceRef = {
  source_type: "session" | "round" | "application" | "story" | "document";
  source_id: string;
};

export const INSIGHT_TYPES = ["weakness", "strength", "pattern"] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export function insightEvidence(insight: Insight): EvidenceRef[] {
  if (!Array.isArray(insight.evidence)) return [];
  const refs: EvidenceRef[] = [];
  for (const e of insight.evidence as unknown[]) {
    if (
      e &&
      typeof e === "object" &&
      "source_type" in e &&
      "source_id" in e &&
      typeof (e as EvidenceRef).source_id === "string"
    ) {
      refs.push(e as EvidenceRef);
    }
  }
  return refs;
}
