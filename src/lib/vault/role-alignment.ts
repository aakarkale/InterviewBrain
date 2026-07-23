import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODEL } from "@/lib/ai/client";

const MAX_CHARS = 6000;
const clip = (t: string) =>
  t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS)}\n…(truncated)` : t;

const textOf = (r: Anthropic.Message) =>
  r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

export type RoleAlignmentResult = {
  fit_score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  talking_points: string[];
};

// Reasons over the candidate's own material (resume, LinkedIn, research) against
// the JD — no external facts, so no citations. Honest about gaps.
export async function generateRoleAlignment(input: {
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resume: string;
  linkedin?: string | null;
  research?: string | null;
}): Promise<RoleAlignmentResult | null> {
  try {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        fit_score: {
          type: "integer",
          description:
            "0–100, how well the candidate's background matches this JD. Be honest; a weak match is a low score.",
        },
        summary: { type: "string", description: "2–3 sentence read on fit." },
        strengths: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific overlaps between the resume/LinkedIn and the JD, each citing a concrete detail.",
        },
        gaps: {
          type: "array",
          items: { type: "string" },
          description: "Honest gaps or stretches vs the JD.",
        },
        talking_points: {
          type: "array",
          items: { type: "string" },
          description: "Concrete things to emphasize or prepare to address.",
        },
      },
      required: ["fit_score", "summary", "strengths", "gaps", "talking_points"],
    };

    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: `You assess how well a candidate fits a specific role, using only the material provided (resume, LinkedIn, research, JD). Never invent experience the candidate doesn't show. Be specific and honest — surfacing real gaps is more useful than flattery.`,
      messages: [
        {
          role: "user",
          content: `Assess fit for the ${input.roleTitle} role at ${input.companyName}.

## Job description
${clip(input.jobDescription)}

## Candidate resume
${clip(input.resume)}
${input.linkedin ? `\n## Candidate LinkedIn profile\n${clip(input.linkedin)}` : ""}
${input.research ? `\n## Candidate research notes\n${clip(input.research)}` : ""}`,
        },
      ],
    });

    const parsed = JSON.parse(textOf(response)) as Partial<RoleAlignmentResult>;
    const clampArr = (a: unknown): string[] =>
      Array.isArray(a) ? a.map((x) => String(x)).filter(Boolean) : [];

    const fit = Math.max(0, Math.min(100, Math.round(Number(parsed.fit_score) || 0)));
    const summary = String(parsed.summary ?? "").trim();
    if (!summary) return null;

    return {
      fit_score: fit,
      summary,
      strengths: clampArr(parsed.strengths),
      gaps: clampArr(parsed.gaps),
      talking_points: clampArr(parsed.talking_points),
    };
  } catch {
    return null;
  }
}
