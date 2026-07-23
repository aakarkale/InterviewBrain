import "server-only";

import { anthropic, MODEL } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { storyTags } from "@/lib/stories/types";
import { INSIGHT_TYPES, type EvidenceRef } from "./types";
import type { RubricScores } from "@/lib/ai/scorer";

const DOC_CLIP = 1500;

type ExtractedInsight = {
  type: string;
  competency_id: string | null;
  summary: string;
  confidence: number;
  evidence: EvidenceRef[];
};

// Cross-role pattern detection (SPEC "the brain"). Aggregates every scored
// session, real-interview note, document, and story for the user, grouped by
// company, asks the model for plain-language insights that each cite evidence
// rows, then replaces the user's active insight set. Returns false (without
// throwing) on any failure — brain regeneration is a background side effect and
// must never surface as a user-facing error on the action that triggered it.
export async function regenerateBrain(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const [
      { data: companies },
      { data: roles },
      { data: interviews },
      { data: sessions },
      { data: rounds },
      { data: documents },
      { data: stories },
      { data: competencies },
    ] = await Promise.all([
      supabase.from("companies").select("id, name"),
      supabase.from("roles").select("id, company_id, title"),
      supabase.from("interviews").select("id, role_id"),
      supabase
        .from("sessions")
        .select(
          "id, interview_id, interview_type, status, rubric_scores, feedback_summary, created_at"
        )
        .eq("status", "completed"),
      supabase
        .from("rounds")
        .select("id, interview_id, round_type, round_name, outcome, post_round_notes"),
      supabase.from("documents").select("id, role_id, type, title, content"),
      supabase.from("stories").select("*"),
      supabase.from("competencies").select("id, name, interview_type"),
    ]);

    const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]));
    // role.id -> { companyId, companyName, roleTitle }
    const roleInfo = new Map(
      (roles ?? []).map((r) => [
        r.id,
        {
          companyId: r.company_id,
          companyName: companyName.get(r.company_id) ?? "Unknown",
          roleTitle: r.title,
        },
      ])
    );
    const interviewRole = new Map(
      (interviews ?? []).map((iv) => [iv.id, iv.role_id])
    );

    function viaInterview(interviewId: string | null) {
      if (!interviewId) return null;
      const roleId = interviewRole.get(interviewId);
      if (!roleId) return null;
      return roleInfo.get(roleId) ?? null;
    }

    const scoredSessions = (sessions ?? []).filter(
      (s) => s.rubric_scores && Object.keys(s.rubric_scores).length > 0
    );
    const notedRounds = (rounds ?? []).filter(
      (r) => r.post_round_notes && r.post_round_notes.trim().length > 0
    );
    const realDocs = (documents ?? []).filter(
      (d) => d.type === "call_transcript" || d.type === "call_summary"
    );

    // Not enough signal yet — clear stale insights and stop. The brain needs at
    // least one scored session or one logged real-round note to say anything.
    if (scoredSessions.length === 0 && notedRounds.length === 0) {
      await supabase.from("insights").delete().eq("user_id", user.id);
      return true;
    }

    const competencyNameMap = new Map(
      (competencies ?? []).map((c) => [c.id, c.name])
    );
    const validCompetencyIds = new Set((competencies ?? []).map((c) => c.id));

    // Valid evidence ids per source type, so hallucinated citations can be
    // dropped before insert (SPEC: insights must cite evidence rows).
    const validIds: Record<EvidenceRef["source_type"], Set<string>> = {
      session: new Set(scoredSessions.map((s) => s.id)),
      round: new Set(notedRounds.map((r) => r.id)),
      document: new Set((documents ?? []).map((d) => d.id)),
      story: new Set((stories ?? []).map((s) => s.id)),
      company: new Set((companies ?? []).map((c) => c.id)),
      role: new Set((roles ?? []).map((r) => r.id)),
      application: new Set(),
    };

    // Deterministic competency aggregation: average score and which companies it
    // showed up at, so the model reasons over real cross-company recurrence.
    const agg = new Map<
      string,
      { total: number; n: number; companies: Set<string> }
    >();
    const sessionLines: string[] = [];
    for (const s of scoredSessions) {
      const scores = s.rubric_scores as RubricScores;
      const info = viaInterview(s.interview_id);
      const company = info?.companyName ?? "Unknown";
      const parts: string[] = [];
      for (const [cid, v] of Object.entries(scores)) {
        const cur = agg.get(cid) ?? { total: 0, n: 0, companies: new Set() };
        cur.total += v.score;
        cur.n += 1;
        cur.companies.add(company);
        agg.set(cid, cur);
        parts.push(`${competencyNameMap.get(cid) ?? cid}=${v.score}/5`);
      }
      sessionLines.push(
        `- session ${s.id} [${company} — ${info?.roleTitle ?? "role"}, ${s.interview_type}]: ${parts.join(", ")}`
      );
    }

    const aggLines = [...agg.entries()]
      .map(([cid, v]) => {
        const avg = (v.total / v.n).toFixed(1);
        return `- ${competencyNameMap.get(cid) ?? cid} (${cid}): avg ${avg}/5 across ${v.n} session(s), companies: ${[...v.companies].join(", ")}`;
      })
      .join("\n");

    const roundLines = notedRounds
      .map((r) => {
        const info = viaInterview(r.interview_id);
        const label = r.round_name ?? r.round_type;
        return `- round ${r.id} [${info?.companyName ?? "Unknown"} — ${info?.roleTitle ?? "role"}, ${label}, ${r.outcome}]: ${r.post_round_notes}`;
      })
      .join("\n");

    const docLines = realDocs
      .map((d) => {
        const info = d.role_id ? roleInfo.get(d.role_id) : null;
        return `- document ${d.id} [${info?.companyName ?? "Unknown"}, ${d.type}] "${d.title}": ${d.content.slice(0, DOC_CLIP)}`;
      })
      .join("\n");

    const storyLines = (stories ?? [])
      .map(
        (s) =>
          `- story ${s.id} "${s.title}" tags: ${storyTags(s).join(", ") || "none"}`
      )
      .join("\n");

    const companyLines = (companies ?? [])
      .map((c) => `- company ${c.id}: ${c.name}`)
      .join("\n");

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        insights: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: [...INSIGHT_TYPES] },
              competency_id: {
                type: "string",
                enum: [...validCompetencyIds, "none"],
                description:
                  "A competency id from the seeded list, or 'none' if this insight doesn't map cleanly to one.",
              },
              summary: {
                type: "string",
                description:
                  "One plain-language insight in 1–2 sentences, addressed to the candidate as 'you', citing specifics (companies, competencies). E.g. 'Metrics questions are your weakest area — you scored 2/5 on them at Stripe and Figma.'",
              },
              confidence: {
                type: "number",
                description:
                  "0–1. Higher when the pattern recurs across multiple companies or is corroborated by both practice scores and real-round notes.",
              },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    source_type: {
                      type: "string",
                      enum: ["session", "round", "company", "role", "story", "document"],
                    },
                    source_id: { type: "string" },
                  },
                  required: ["source_type", "source_id"],
                },
              },
            },
            required: ["type", "competency_id", "summary", "confidence", "evidence"],
          },
        },
      },
      required: ["insights"],
    };

    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 3072,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema },
      },
      system: `You are the analytical "brain" of an interview-prep tool for product managers interviewing at several companies at once. Your job is cross-company pattern detection: find recurring strengths, weaknesses, and patterns that span the candidate's companies and roles, and state them as plain-language insights a busy PM can act on.

Rules:
- Every insight MUST cite at least one evidence item, using only the ids provided below. Never invent ids. To attribute a pattern to a company, cite that company id.
- Weight recurrence across DIFFERENT companies most heavily — a weakness seen at three companies is the headline. Set confidence higher for cross-company patterns.
- Treat real-round notes and call transcripts as higher-signal than practice scores: they reflect what actually happened and what companies actually asked.
- Tie an insight to a competency_id when it maps cleanly to one of the seeded competencies; otherwise set competency_id to 'none' (e.g. a behavioral cross-cutting pattern).
- Be specific and honest. Reference companies and scores. No vague encouragement.
- Produce at most 8 insights, ranked by importance. Prefer fewer, sharper insights over many weak ones.`,
      messages: [
        {
          role: "user",
          content: `Analyze this candidate's data and extract insights.

## Companies
${companyLines || "(none)"}

## Aggregate competency scores (across practice sessions)
${aggLines || "(no scored sessions yet)"}

## Practice sessions
${sessionLines.join("\n") || "(none)"}

## Real interview round notes (high signal)
${roundLines || "(none)"}

## Call transcripts & summaries (high signal — what companies actually asked)
${docLines || "(none)"}

## Story bank
${storyLines || "(none)"}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = JSON.parse(text) as { insights: ExtractedInsight[] };

    const rows = (parsed.insights ?? [])
      .map((ins) => {
        const evidence = (ins.evidence ?? []).filter(
          (e) => validIds[e.source_type]?.has(e.source_id)
        );
        if (evidence.length === 0) return null;
        if (!INSIGHT_TYPES.includes(ins.type as (typeof INSIGHT_TYPES)[number]))
          return null;
        const competency_id =
          ins.competency_id && validCompetencyIds.has(ins.competency_id)
            ? ins.competency_id
            : null;
        const confidence = Math.max(0, Math.min(1, Number(ins.confidence) || 0));
        const summary = String(ins.summary ?? "").trim();
        if (!summary) return null;
        return {
          user_id: user.id,
          type: ins.type,
          competency_id,
          summary,
          evidence,
          confidence,
          status: "active",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Replace the active set: delete then insert. Insights are fully derived.
    const { error: delError } = await supabase
      .from("insights")
      .delete()
      .eq("user_id", user.id);
    if (delError) return false;

    if (rows.length > 0) {
      const { error: insError } = await supabase.from("insights").insert(rows);
      if (insError) return false;
    }

    return true;
  } catch {
    return false;
  }
}
