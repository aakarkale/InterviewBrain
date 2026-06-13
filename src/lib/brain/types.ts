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

// ---- Mind-map graph (SPEC: derived at render time, never stored) ----

export type GraphNodeKind = "company" | "competency" | "story";
export type GraphState = "weakness" | "strength" | "neutral";

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  state: GraphState;
  // Relative importance, drives node size (e.g. a competency weak across
  // several companies is bigger).
  weight: number;
  detail: string | null;
};

export type GraphEdgeKind = "scored" | "tagged" | "pattern";

export type GraphEdge = {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  state: GraphState;
  // 0..1 emphasis — pattern links from high-confidence insights draw boldest.
  strength: number;
};

export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };
