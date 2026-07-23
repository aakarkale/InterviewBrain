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

// Derives the mind-map graph at request time from companies, competencies,
// insights, sessions, and stories (SPEC: the map has no table). Nodes are
// companies, competencies, and stories; edges are practice scores, story tags,
// and the brain's pattern links. RLS scopes everything to the owner.
export async function getBrainGraph(): Promise<GraphData> {
  const supabase = await createClient();

  const [
    { data: companies },
    { data: roles },
    { data: interviews },
    { data: competencies },
    { data: insights },
    { data: sessions },
    { data: stories },
  ] = await Promise.all([
    supabase.from("companies").select("id, name, is_archived"),
    supabase.from("roles").select("id, company_id"),
    supabase.from("interviews").select("id, role_id"),
    supabase.from("competencies").select("id, name"),
    supabase.from("insights").select("*").eq("status", "active"),
    supabase
      .from("sessions")
      .select("interview_id, rubric_scores")
      .eq("status", "completed"),
    supabase.from("stories").select("id, title, competency_tags"),
  ]);

  const activeCompanies = (companies ?? []).filter((c) => !c.is_archived);
  const companyExists = new Set(activeCompanies.map((c) => c.id));
  const competencyName = new Map((competencies ?? []).map((c) => [c.id, c.name]));

  const roleCompany = new Map((roles ?? []).map((r) => [r.id, r.company_id]));
  const interviewCompany = new Map(
    (interviews ?? []).map((iv) => [iv.id, roleCompany.get(iv.role_id) ?? null])
  );

  // Map any evidence ref that identifies a company (company / role / legacy
  // application) to its active company id.
  function evidenceCompany(sourceType: string, sourceId: string): string | null {
    if (sourceType === "company" || sourceType === "application") {
      return companyExists.has(sourceId) ? sourceId : null;
    }
    if (sourceType === "role") {
      const cid = roleCompany.get(sourceId);
      return cid && companyExists.has(cid) ? cid : null;
    }
    return null;
  }

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
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
    const companyId = session.interview_id
      ? interviewCompany.get(session.interview_id)
      : null;
    if (!companyId || !companyExists.has(companyId)) continue;
    for (const [competencyId, value] of Object.entries(scores)) {
      if (!ensureCompetency(competencyId)) continue;
      usedCompanies.add(companyId);
      const set = competencyCompanies.get(competencyId) ?? new Set<string>();
      set.add(companyId);
      competencyCompanies.set(competencyId, set);
      edges.push({
        source: nodeId.company(companyId),
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
  // and stories it cites.
  for (const insight of insights ?? []) {
    const state = insightState(insight.type);
    let competencyNode: string | null = null;
    if (insight.competency_id && ensureCompetency(insight.competency_id)) {
      competencyNode = nodeId.competency(insight.competency_id);
      const node = nodes.get(competencyNode)!;
      if (node.state === "neutral") node.state = state;
      if (!node.detail) node.detail = insight.summary;
    }

    for (const ref of insightEvidence(insight)) {
      let target: string | null = null;
      const companyId = evidenceCompany(ref.source_type, ref.source_id);
      if (companyId) {
        target = nodeId.company(companyId);
        usedCompanies.add(companyId);
      } else if (
        ref.source_type === "story" &&
        (stories ?? []).some((s) => s.id === ref.source_id)
      ) {
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

  // Company nodes: every active company is an anchor (an isolated one is itself
  // a signal — a vault with no prep yet).
  for (const company of activeCompanies) {
    const id = nodeId.company(company.id);
    const connected = usedCompanies.has(company.id);
    nodes.set(id, {
      id,
      kind: "company",
      label: company.name,
      state: "neutral",
      weight: connected ? 3 : 2,
      detail: connected ? null : "No practice yet",
    });
  }

  for (const competencyId of usedCompetencies) {
    const id = nodeId.competency(competencyId);
    const node = nodes.get(id);
    if (node) node.weight = 1.4 + (competencyCompanies.get(competencyId)?.size ?? 0);
  }

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
