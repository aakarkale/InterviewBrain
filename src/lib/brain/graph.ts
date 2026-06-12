import { createClient } from "@/lib/supabase/server";
import { storyTags } from "@/lib/stories/types";
import { insightEvidence } from "./types";
import type {
  GraphData,
  GraphEdge,
  GraphNode,
  GraphState,
} from "./types";
import type { RubricScores } from "@/lib/ai/scorer";

const nodeId = {
  company: (id: string) => `company:${id}`,
  competency: (id: string) => `competency:${id}`,
  story: (id: string) => `story:${id}`,
};

function scoreState(avg: number): GraphState {
  if (avg <= 2.4) return "weakness";
  if (avg >= 3.6) return "strength";
  return "neutral";
}

function insightState(type: string): GraphState {
  if (type === "weakness") return "weakness";
  if (type === "strength") return "strength";
  return "neutral";
}

// Derives the mind-map graph at request time from applications, competencies,
// insights, sessions, and stories (SPEC: the map has no table). Nodes are
// companies, competencies, and stories; edges are practice scores, story tags,
// and the brain's pattern links. RLS scopes everything to the owner.
export async function getBrainGraph(): Promise<GraphData> {
  const supabase = await createClient();

  const [
    { data: applications },
    { data: competencies },
    { data: insights },
    { data: sessions },
    { data: stories },
  ] = await Promise.all([
    supabase.from("applications").select("id, company_name, is_archived"),
    supabase.from("competencies").select("id, name"),
    supabase.from("insights").select("*").eq("status", "active"),
    supabase
      .from("sessions")
      .select("application_id, rubric_scores")
      .eq("status", "completed"),
    supabase.from("stories").select("id, title, competency_tags"),
  ]);

  const apps = (applications ?? []).filter((a) => !a.is_archived);
  const competencyName = new Map((competencies ?? []).map((c) => [c.id, c.name]));

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  // Companies touching a competency — drives competency node weight so a
  // cross-company weakness reads as the largest, most-connected node.
  const competencyCompanies = new Map<string, Set<string>>();
  const usedCompetencies = new Set<string>();
  const usedStories = new Set<string>();
  const usedCompanies = new Set<string>();

  function ensureCompetency(competencyId: string) {
    if (!competencyName.has(competencyId)) return false;
    const id = nodeId.competency(competencyId);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: "competency",
        label: competencyName.get(competencyId)!,
        state: "neutral",
        weight: 1,
        detail: null,
      });
    }
    usedCompetencies.add(competencyId);
    return true;
  }

  // 1. Practice scores: company ↔ competency, colored by score.
  for (const session of sessions ?? []) {
    const scores = session.rubric_scores as RubricScores | null;
    if (!scores) continue;
    const company = apps.find((a) => a.id === session.application_id);
    if (!company) continue;
    for (const [competencyId, value] of Object.entries(scores)) {
      if (!ensureCompetency(competencyId)) continue;
      usedCompanies.add(company.id);
      const set =
        competencyCompanies.get(competencyId) ?? new Set<string>();
      set.add(company.id);
      competencyCompanies.set(competencyId, set);
      edges.push({
        source: nodeId.company(company.id),
        target: nodeId.competency(competencyId),
        kind: "scored",
        state: scoreState(value.score),
        strength: Math.min(1, Math.abs(value.score - 3) / 2 + 0.3),
      });
    }
  }

  // 2. Story tags: story ↔ competency.
  for (const story of stories ?? []) {
    const tags = storyTags(story).filter((t) => competencyName.has(t));
    if (tags.length === 0) continue;
    const sid = nodeId.story(story.id);
    if (!nodes.has(sid)) {
      nodes.set(sid, {
        id: sid,
        kind: "story",
        label: story.title,
        state: "neutral",
        weight: 1,
        detail: "STAR story",
      });
    }
    usedStories.add(story.id);
    for (const competencyId of tags) {
      ensureCompetency(competencyId);
      edges.push({
        source: sid,
        target: nodeId.competency(competencyId),
        kind: "tagged",
        state: "neutral",
        strength: 0.4,
      });
    }
  }

  // 3. Brain pattern links: each insight ties its competency to the companies
  // and stories it cites. These are the headline edges — a cross-company
  // weakness fans out from one competency to several company nodes.
  for (const insight of insights ?? []) {
    const state = insightState(insight.type);
    let competencyNode: string | null = null;
    if (insight.competency_id && ensureCompetency(insight.competency_id)) {
      competencyNode = nodeId.competency(insight.competency_id);
      const node = nodes.get(competencyNode)!;
      // Weakness/strength color wins over neutral; keep the best insight's text.
      if (node.state === "neutral") node.state = state;
      if (!node.detail) node.detail = insight.summary;
    }

    for (const ref of insightEvidence(insight)) {
      let target: string | null = null;
      if (ref.source_type === "application" && apps.some((a) => a.id === ref.source_id)) {
        target = nodeId.company(ref.source_id);
        usedCompanies.add(ref.source_id);
      } else if (ref.source_type === "story" && (stories ?? []).some((s) => s.id === ref.source_id)) {
        target = nodeId.story(ref.source_id);
        usedStories.add(ref.source_id);
      }
      if (!target || !competencyNode || target === competencyNode) continue;
      edges.push({
        source: competencyNode,
        target,
        kind: "pattern",
        state,
        strength: Math.min(1, 0.5 + insight.confidence * 0.5),
      });
    }
  }

  // Company nodes: every active application is an anchor (an isolated one is
  // itself a signal — a vault with no prep yet).
  for (const app of apps) {
    const id = nodeId.company(app.id);
    const connected = usedCompanies.has(app.id);
    nodes.set(id, {
      id,
      kind: "company",
      label: app.company_name,
      state: "neutral",
      weight: connected ? 3 : 2,
      detail: connected ? null : "No practice yet",
    });
  }

  // Size competencies by how many companies they span + a base.
  for (const competencyId of usedCompetencies) {
    const id = nodeId.competency(competencyId);
    const node = nodes.get(id);
    if (node) node.weight = 1.4 + (competencyCompanies.get(competencyId)?.size ?? 0);
  }

  // Ensure stories referenced only by tags/patterns exist as labeled nodes.
  for (const story of stories ?? []) {
    if (!usedStories.has(story.id)) continue;
    const id = nodeId.story(story.id);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: "story",
        label: story.title,
        state: "neutral",
        weight: 1,
        detail: "STAR story",
      });
    }
  }

  // Prune dangling edges (whose endpoints didn't materialize) and any node
  // left with no edge except company anchors.
  const present = new Set(nodes.keys());
  const liveEdges = edges.filter(
    (e) => present.has(e.source) && present.has(e.target)
  );
  const degree = new Map<string, number>();
  for (const e of liveEdges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const liveNodes = [...nodes.values()].filter(
    (n) => n.kind === "company" || (degree.get(n.id) ?? 0) > 0
  );

  return { nodes: liveNodes, edges: liveEdges };
}
