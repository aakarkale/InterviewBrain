import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODEL } from "@/lib/ai/client";

const CLIP = 4000;
const clip = (t: string) => (t.length > CLIP ? `${t.slice(0, CLIP)}\n…` : t);
const textOf = (r: Anthropic.Message) =>
  r.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");

export type InterviewPrepResult = {
  focus_areas: { title: string; detail: string }[];
  likely_questions: string[];
  tips: string[];
};

// Synthesizes prep guidance from everything in the vault + role + rounds. Uses
// only provided material (no web) — it's advice, not facts to cite.
export async function generateInterviewPrep(input: {
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resume: string;
  roundPlan: { name: string; type: string }[];
  documents: { title: string; type: string; content: string }[];
  priorNotes: string[];
}): Promise<InterviewPrepResult | null> {
  try {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        focus_areas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" }, detail: { type: "string" } },
            required: ["title", "detail"],
          },
        },
        likely_questions: { type: "array", items: { type: "string" } },
        tips: { type: "array", items: { type: "string" } },
      },
      required: ["focus_areas", "likely_questions", "tips"],
    };

    const docs = input.documents
      .map((d) => `### ${d.type}: ${d.title}\n${clip(d.content)}`)
      .join("\n\n");

    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2560,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: `You coach a candidate preparing for an interview. Ground every suggestion in the material provided — the JD, their resume, the planned rounds, their research, and any real call transcripts (weight transcripts heavily; they show what this company actually asks). Be specific and actionable, not generic.`,
      messages: [
        {
          role: "user",
          content: `Build interview prep for the ${input.roleTitle} role at ${input.companyName}.

## Planned rounds
${input.roundPlan.map((r) => `- ${r.name} (${r.type})`).join("\n") || "(none set)"}

## Job description
${clip(input.jobDescription)}

## Candidate resume
${clip(input.resume)}
${docs ? `\n## Vault documents\n${docs}` : ""}
${input.priorNotes.length ? `\n## Notes from earlier rounds\n${input.priorNotes.map((n) => `- ${n}`).join("\n")}` : ""}`,
        },
      ],
    });

    const parsed = JSON.parse(textOf(response)) as Partial<InterviewPrepResult>;
    const focus = Array.isArray(parsed.focus_areas)
      ? parsed.focus_areas
          .map((f) => ({ title: String(f?.title ?? "").trim(), detail: String(f?.detail ?? "").trim() }))
          .filter((f) => f.title && f.detail)
      : [];
    const arr = (a: unknown) => (Array.isArray(a) ? a.map(String).filter(Boolean) : []);
    if (focus.length === 0 && arr(parsed.likely_questions).length === 0) return null;

    return {
      focus_areas: focus,
      likely_questions: arr(parsed.likely_questions),
      tips: arr(parsed.tips),
    };
  } catch {
    return null;
  }
}
