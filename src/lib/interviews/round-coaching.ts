import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODEL } from "@/lib/ai/client";

const CLIP = 6000;
const clip = (t: string) => (t.length > CLIP ? `${t.slice(0, CLIP)}\n…` : t);
const textOf = (r: Anthropic.Message) =>
  r.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");

export type RoundCoachingResult = {
  summary: string;
  what_went_well: string[];
  gaps: string[];
  next_round_focus: string[];
};

// Reads a completed round's notes/transcript/summary (plus earlier rounds) and
// coaches the candidate into the next round.
export async function generateRoundCoaching(input: {
  companyName: string;
  roleTitle: string;
  round: { name: string; type: string; outcome: string; notes?: string | null; transcript?: string | null; summary?: string | null };
  priorRounds: { name: string; outcome: string; notes?: string | null; summary?: string | null }[];
}): Promise<RoundCoachingResult | null> {
  const { round } = input;
  const material = [round.notes, round.transcript, round.summary]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join("\n");
  if (!material.trim()) return null;

  try {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        what_went_well: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
        next_round_focus: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "what_went_well", "gaps", "next_round_focus"],
    };

    const prior = input.priorRounds
      .map((r) => `- ${r.name} (${r.outcome}): ${[r.notes, r.summary].filter(Boolean).join(" ") || "no notes"}`)
      .join("\n");

    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: `You coach a candidate between interview rounds. Read what actually happened in the round below and give honest, specific guidance for the next one. Ground everything in the material; don't invent details.`,
      messages: [
        {
          role: "user",
          content: `Coach me for the next round after this ${round.name} (${round.type}) round at ${input.companyName} for the ${input.roleTitle} role. Outcome: ${round.outcome}.

## This round
${clip(material)}
${prior ? `\n## Earlier rounds\n${prior}` : ""}`,
        },
      ],
    });

    const parsed = JSON.parse(textOf(response)) as Partial<RoundCoachingResult>;
    const arr = (a: unknown) => (Array.isArray(a) ? a.map(String).filter(Boolean) : []);
    const summary = String(parsed.summary ?? "").trim();
    if (!summary) return null;

    return {
      summary,
      what_went_well: arr(parsed.what_went_well),
      gaps: arr(parsed.gaps),
      next_round_focus: arr(parsed.next_round_focus),
    };
  } catch {
    return null;
  }
}
