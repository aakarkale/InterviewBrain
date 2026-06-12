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

// Cross-application pattern detection (SPEC "the brain"). Aggregates every
// scored session, real-interview note, document, and story for the user, asks
// the model for plain-language insights that each cite evidence rows, then
// replaces the user's active insight set. Returns false (without throwing) on
// any failure — brain regeneration is a background side effect and must never
// surface as a user-facing error on the action that triggered it.
export async function regenerateBrain(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const [
      { data: applications },
      { data: sessions },
      { data: rounds },
      { data: documents },
      { data: stories },
      { data: competencies },
    ] = await Promise.all([
      supabase.from("applications").select("id, company_name, role_title"),
      supabase
        .from("sessions")
        .select(
          "id, application_id, interview_type, status, rubric_scores, feedback_summary, transcript, created_at"
        )
        .eq("status", "completed"),
      supabase
        .from("rounds")
        .select(
          "id, application_id, round_type, outcome, post_round_notes"
        ),
      supabase.from("documents").select("id, application_id, type, title, content"),
      supabase.from("stories").select("*"),
      supabase.from("competencies").select("id, name, interview_type"),
    ]);

    const apps = applications ?? [];
    const scoredSessions = (sessions ?? []).filter(
      (s) => s.rubric_scores && Object.keys(s.rubric_scores).length > 0
    );
    const notedRounds = (rounds ?? []).filter(
      (r) => r.post_round_notes && r.post_round_notes.trim().length > 0
    );
    const realDocs = (documents ?? []).filter(
      (d) => d.type === "call_transcript" || d.type === "call_summary"
    );

    // Not enough signal yet — clear stale insights and stop. The brain needs
    // at least one scored session or one logged real-round note to say
    // anything grounded.
    if (scoredSessions.length === 0 && notedRounds.length === 0) {
      await supabase.from("insights").delete().eq("user_id", user.id);
      return true;
    }

    const appName = new Map(
      apps.map((a) => [a.id, `${a.company_name} — ${a.role_title}`])
    );
    const competencyName = new Map(
      (competencies ?? []).map((c) => [c.id, c.name])
    );
    const validCompetencyIds = new Set((competencies ?? []).map((c) => c.id));

    // Valid evidence ids per source type, so hallucinated citations can be
    // dropped before insert (SPEC: insights must cite evidence rows).
    const validIds: Record<EvidenceRef["source_type"], Set<string>> = {
      session: new Set(scoredSessions.map((s) => s.id)),
      round: new Set(notedRounds.map((r) => r.id)),
      application: new Set(apps.map((a) => a.id)),
      story: new Set((stories ?? []).map((s) => s.id)),
      document: new Set((documents ?? []).map((d) => d.id)),
    };

    // Deterministic competency aggregation: average score and which companies
    // it showed up at, so the model reasons over real cross-app recurrence
    // rather than re-deriving arithmetic.
    const agg = new Map<
      string,
      { total: number; n: number; apps: Set<string> }
    >();
    const sessionLines: string[] = [];
    for (const s of scoredSessions) {
      const scores = s.rubric_scores as RubricScores;
      const company = appName.get(s.application_id) ?? "Unknown";
      const parts: string[] = [];
      for (const [cid, v] of Object.entries(scores)) {
        const cur = agg.get(cid) ?? { total: 0, n: 0, apps: new Set() };
        cur.total += v.score;
        cur.n += 1;
        cur.apps.add(company);
        agg.set(cid, cur);
        parts.push(`${competencyName.get(cid) ?? cid}=${v.score}/5`);
      }
      sessionLines.push(
        `- session ${s.id} [${company}, ${s.interview_type}]: ${parts.join(", ")}`
      );
    }

    const aggLines = [...agg.entries()]
      .map(([cid, v]) => {
        const avg = (v.total / v.n).toFixed(1);
        return `- ${competencyName.get(cid) ?? cid} (${cid}): avg ${avg}/5 across ${v.n} session(s), companies: ${[...v.apps].join(", ")}`;
      })
      .join("\n");

    const roundLines = notedRounds
      .map(
        (r) =>
          `- round ${r.id} [${appName.get(r.application_id) ?? "Unknown"}, ${r.round_type}, ${r.outcome}]: ${r.post_round_notes}`
      )
      .join("\n");

    const docLines = realDocs
      .map(
        (d) =>
          `- document ${d.id} [${appName.get(d.application_id) ?? "Unknown"}, ${d.type}] "${d.title}": ${d.content.slice(0, DOC_CLIP)}`
      )
      .join("\n");

    const storyLines = (stories ?? [])
      .map(
        (s) =>
          `- story ${s.id} "${s.title}" tags: ${storyTags(s).join(", ") || "none"}`
      )
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
                // Structured outputs reject a string enum under a nullable
                // type, so use a "none" sentinel and map it back to null.
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
                  "0–1. Higher when the pattern recurs across multiple applications or is corroborated by both practice scores and real-round notes.",
              },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    source_type: {
                      type: "string",
                      enum: ["session", "round", "application", "story", "document"],
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
        // Medium balances analysis depth against function-duration limits;
        // the manual refresh and event-driven regen both run server-side.
        effort: "medium",
        format: { type: "json_schema", schema },
      },
      system: `You are the analytical "brain" of an interview-prep tool for product managers interviewing at several companies at once. Your job is cross-application pattern detection: find recurring strengths, weaknesses, and patterns that span the candidate's applications, and state them as plain-language insights a busy PM can act on.

Rules:
- Every insight MUST cite at least one evidence item, using only the ids provided below. Never invent ids.
- Weight recurrence across DIFFERENT companies most heavily — a weakness seen at three companies is the headline. Set confidence higher for cross-company patterns.
- Treat real-round notes and call transcripts as higher-signal than practice scores: they reflect what actually happened and what companies actually asked.
- Tie an insight to a competency_id when it maps cleanly to one of the seeded competencies; otherwise set competency_id to null (e.g. a behavioral cross-cutting pattern).
- Be specific and honest. Reference companies and scores. No vague encouragement.
- Produce at most 8 insights, ranked by importance. Prefer fewer, sharper insights over many weak ones. If there isn't enough signal for cross-company patterns yet, return only what the data supports.`,
      messages: [
        {
          role: "user",
          content: `Analyze this candidate's data and extract insights.

## Applications
${apps.map((a) => `- application ${a.id}: ${a.company_name} — ${a.role_title}`).join("\n") || "(none)"}

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
        // Drop free-floating insights: the SPEC forbids insights without
        // evidence rows.
        if (evidence.length === 0) return null;
        if (!INSIGHT_TYPES.includes(ins.type as (typeof INSIGHT_TYPES)[number]))
          return null;
        const competency_id =
          ins.competency_id && validCompetencyIds.has(ins.competency_id)
            ? ins.competency_id
            : null; // "none" sentinel and any stray value fall through to null
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

    // Replace the active set atomically-ish: delete then insert. Insights are
    // fully derived, so a clean replace is correct and keeps the table from
    // accumulating stale rows.
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
