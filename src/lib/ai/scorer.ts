import "server-only";

import { anthropic, MODEL } from "./client";
import { createClient } from "@/lib/supabase/server";
import { parseTranscript } from "@/lib/sessions/constants";

// rubric_scores jsonb shape (SPEC: competency_id → score + comments).
export type RubricScore = { score: number; comment: string };
export type RubricScores = Record<string, RubricScore>;

const SCORE_LEGEND = `Score each competency 1–5:
5 = exceptional, would impress a bar-raiser
4 = strong, clearly above the bar
3 = solid, meets the bar with gaps
2 = below bar, notable weaknesses
1 = serious concerns
Only score a competency the interview actually surfaced. Omit any competency the candidate had no real chance to demonstrate — do not pad with guesses.`;

type ScoringResult = {
  summary: string;
  scores: { competency_id: string; score: number; comment: string }[];
};

// Scores a completed session's transcript against the seeded competency
// taxonomy for its interview type. Writes rubric_scores + feedback_summary.
// Returns false (without throwing) on any failure so session completion is
// never blocked by a scoring hiccup — the feedback view offers a re-score.
export async function scoreSession(sessionId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, interview_type, transcript")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return false;

  const transcript = parseTranscript(session.transcript);
  const candidateTurns = transcript.filter((m) => m.role === "user");
  if (candidateTurns.length === 0) {
    await supabase
      .from("sessions")
      .update({
        feedback_summary:
          "This session ended before you answered any questions, so there's nothing to score yet. Start a new session and work through a few questions to get feedback.",
        rubric_scores: {},
      })
      .eq("id", sessionId);
    return true;
  }

  const { data: competencies } = await supabase
    .from("competencies")
    .select("id, name")
    .eq("interview_type", session.interview_type);

  if (!competencies || competencies.length === 0) return false;

  const competencyIds = competencies.map((c) => c.id);
  const competencyList = competencies
    .map((c) => `- ${c.id}: ${c.name}`)
    .join("\n");

  const conversation = transcript
    .map(
      (m) =>
        `${m.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${m.content}`
    )
    .join("\n\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
        description:
          "2–4 sentences: the candidate's overall performance and the single most important thing to fix before the real interview. Address the candidate as 'you'.",
      },
      scores: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            competency_id: { type: "string", enum: competencyIds },
            score: { type: "integer", enum: [1, 2, 3, 4, 5] },
            comment: {
              type: "string",
              description:
                "1–2 sentences of specific, evidence-based feedback citing what the candidate actually said. Address them as 'you'.",
            },
          },
          required: ["competency_id", "score", "comment"],
        },
      },
    },
    required: ["summary", "scores"],
  };

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema },
      },
      system: `You are a rigorous, fair product-management interview coach. You are scoring a completed ${session.interview_type.replace("_", " ")} mock interview against a fixed competency rubric. Be specific and honest — vague praise helps no one. Ground every comment in what the candidate actually said.

Competencies for this interview type (score by id):
${competencyList}

${SCORE_LEGEND}`,
      messages: [
        {
          role: "user",
          content: `Here is the full interview transcript. Score it.\n\n${conversation}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = JSON.parse(text) as ScoringResult;
    const valid = new Set(competencyIds);

    const rubric_scores: RubricScores = {};
    for (const row of parsed.scores ?? []) {
      if (
        valid.has(row.competency_id) &&
        typeof row.score === "number" &&
        row.score >= 1 &&
        row.score <= 5
      ) {
        rubric_scores[row.competency_id] = {
          score: row.score,
          comment: String(row.comment ?? ""),
        };
      }
    }

    const { error } = await supabase
      .from("sessions")
      .update({
        feedback_summary: parsed.summary?.trim() || "Feedback generated.",
        rubric_scores,
      })
      .eq("id", sessionId);

    return !error;
  } catch {
    return false;
  }
}
