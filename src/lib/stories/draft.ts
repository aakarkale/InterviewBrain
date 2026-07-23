import "server-only";

import { anthropic, MODEL } from "@/lib/ai/client";
import type { StoryDraft } from "./types";

export type { StoryDraft } from "./types";

// The raw material a story is shaped from: the answer the candidate actually
// gave in a behavioral mock, plus the surrounding thread so follow-up probes
// (which often carry the measurable result) aren't lost.
export type DraftInput = {
  question: string;
  answer: string;
  followUps: { question: string; answer: string }[];
  competencies: { id: string; name: string }[];
};

const MAX_TURN_CHARS = 4000;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n…(truncated)` : text;
}

// Turns a candidate's spoken-style mock answer into a clean, reusable STAR
// story (title + body + suggested competency tags). Returns null on any
// failure — drafting is an assist, never a blocker, so the caller falls back
// to the raw answer. Mirrors the scorer/brain AI conventions (adaptive
// thinking + structured json_schema output on the shared MODEL).
export async function draftStoryFromAnswer(
  input: DraftInput
): Promise<StoryDraft | null> {
  const { question, answer, followUps, competencies } = input;
  if (!answer.trim() || competencies.length === 0) return null;

  const competencyIds = competencies.map((c) => c.id);
  const competencyList = competencies
    .map((c) => `- ${c.id}: ${c.name}`)
    .join("\n");

  const followUpBlock = followUps
    .map(
      (f) =>
        `INTERVIEWER: ${clip(f.question, MAX_TURN_CHARS)}\nYOU: ${clip(f.answer, MAX_TURN_CHARS)}`
    )
    .join("\n\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        description:
          "A short, memorable handle for the story (≤ 8 words), e.g. 'Turned around the churning enterprise account'. No trailing punctuation.",
      },
      content: {
        type: "string",
        description:
          "The story rewritten in first person as tight STAR prose — Situation, Task, Action, Result — in 1–3 short paragraphs. Use ONLY facts the candidate actually stated. If a STAR element is missing (most often a quantified result), leave a short bracketed placeholder like '[add the metric]' instead of inventing one.",
      },
      competency_tags: {
        type: "array",
        description:
          "0–3 competency ids from the provided list that this story most clearly demonstrates. Prefer fewer, well-supported tags over many weak ones.",
        items: { type: "string", enum: competencyIds },
      },
    },
    required: ["title", "content", "competency_tags"],
  };

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1200,
      thinking: { type: "adaptive" },
      output_config: {
        // A focused rewriting task — low effort keeps the "Draft" click snappy.
        effort: "low",
        format: { type: "json_schema", schema },
      },
      system: `You help a product manager turn an answer they gave in a mock behavioral interview into a polished, reusable STAR story for their story bank. They'll reuse it verbatim in future interviews, so it must read as their own crisp account — not a summary about them.

Rules:
- Write in the FIRST PERSON ("I led…", "I decided…"), the way the candidate would tell it.
- Structure as STAR: the Situation, the Task/goal, the specific Actions they took, and the measurable Result.
- Ground every detail in what the candidate actually said across their answer and any follow-ups. Do NOT invent companies, numbers, or outcomes. If a key STAR element is missing, mark it with a brief bracketed placeholder (e.g. "[add the metric]") so they can fill it in.
- Keep it tight: 1–3 short paragraphs. Cut filler and verbal tics from the spoken answer.
- Tag it with the competencies from the list that it genuinely demonstrates.

Competencies to choose tags from (use the id):
${competencyList}`,
      messages: [
        {
          role: "user",
          content: `Shape the following mock-interview exchange into one reusable STAR story.

INTERVIEWER: ${clip(question, MAX_TURN_CHARS)}

YOU (the answer to shape): ${clip(answer, MAX_TURN_CHARS)}${
            followUpBlock
              ? `\n\nFollow-up probes on the same story (use these for extra detail, especially results):\n\n${followUpBlock}`
              : ""
          }`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = JSON.parse(text) as Partial<StoryDraft>;
    const title = String(parsed.title ?? "").trim();
    const content = String(parsed.content ?? "").trim();
    if (!title || !content) return null;

    const valid = new Set(competencyIds);
    const competency_tags = Array.isArray(parsed.competency_tags)
      ? [...new Set(parsed.competency_tags)].filter(
          (t): t is string => typeof t === "string" && valid.has(t)
        )
      : [];

    return { title, content, competency_tags };
  } catch {
    return null;
  }
}
