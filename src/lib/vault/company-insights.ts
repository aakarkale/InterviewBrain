import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODEL } from "@/lib/ai/client";
import type { CompanyInsightSection, InsightSource } from "./types";

// Company insights must be grounded in real, current sources — the repo's
// verify-before-asserting rule forbids inventing facts from model memory. Web
// search citations are incompatible with structured (json_schema) output in a
// single call, so this runs two passes:
//   1. Research pass — web search enabled, no output_config. Produces cited
//      prose and, deterministically, the real source URLs from the
//      web_search_tool_result blocks.
//   2. Structuring pass — json_schema, no tools. Normalizes the prose into
//      titled sections. The captured sources are attached verbatim.

const RESEARCH_MAX_TOKENS = 3072;
const STRUCTURE_MAX_TOKENS = 2048;
const MAX_SOURCES = 12;

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("")
    .trim();
}

// Capture the real {title, url} pairs the model actually searched.
function captureSources(response: Anthropic.Message): InsightSource[] {
  const seen = new Set<string>();
  const out: InsightSource[] = [];
  for (const block of response.content) {
    if (block.type !== "web_search_tool_result") continue;
    const content = (block as { content: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (
        item &&
        typeof item === "object" &&
        item.type === "web_search_result" &&
        typeof item.url === "string" &&
        !seen.has(item.url)
      ) {
        seen.add(item.url);
        out.push({ title: String(item.title ?? item.url), url: item.url });
      }
    }
  }
  return out.slice(0, MAX_SOURCES);
}

export type CompanyInsightsResult = {
  sections: CompanyInsightSection[];
  sources: InsightSource[];
};

export async function generateCompanyInsights(input: {
  companyName: string;
  h1bEnabled: boolean;
  notes?: string | null;
}): Promise<CompanyInsightsResult | null> {
  const { companyName, h1bEnabled, notes } = input;

  try {
    const topics = [
      "Company overview — what they do, stage, size, and where they're headed",
      "Funding, investors, and valuation or market cap (with dates)",
      "Leadership team — key executives and relevant product/eng leaders",
      "Signals that help a candidate: recent launches, priorities, culture notes",
    ];
    if (h1bEnabled) {
      topics.push(
        "H-1B / visa sponsorship history — whether they sponsor, recent volume, from public LCA/USCIS-style data if available (label clearly as public data to verify)"
      );
    }

    // --- Pass 1: research with web search ---
    const research = await anthropic().messages.create({
      model: MODEL,
      max_tokens: RESEARCH_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      system: `You are a research assistant helping a candidate prep for interviews at a company. Search the web and report only facts you actually found in the results — never guess, never fill gaps from memory. Prefer recent, primary sources. If something can't be verified, say so rather than inventing it. Keep it factual and concise.`,
      messages: [
        {
          role: "user",
          content: `Research ${companyName} for someone interviewing there. Cover, each as its own short paragraph:
${topics.map((t) => `- ${t}`).join("\n")}
${notes ? `\nThe candidate already noted: ${notes}` : ""}`,
        },
      ],
    });

    const researchText = textOf(research);
    const sources = captureSources(research);
    if (!researchText) return null;

    // --- Pass 2: structure into sections (no tools, json_schema) ---
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              key: {
                type: "string",
                description: "short slug, e.g. overview / funding / leadership / h1b / signals",
              },
              title: { type: "string" },
              body: {
                type: "string",
                description:
                  "2–5 sentences, plain language. Only facts present in the research text. If the research says a fact is unverified, keep that caveat.",
              },
            },
            required: ["key", "title", "body"],
          },
        },
      },
      required: ["sections"],
    };

    const structured = await anthropic().messages.create({
      model: MODEL,
      max_tokens: STRUCTURE_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: `Reformat the research below into clean, titled sections for a candidate. Do NOT add any fact that isn't in the research text. Preserve any "unverified"/"could not confirm" caveats. Omit a section entirely if the research had nothing for it.`,
      messages: [{ role: "user", content: researchText }],
    });

    const parsed = JSON.parse(textOf(structured)) as {
      sections?: CompanyInsightSection[];
    };

    const sections = (parsed.sections ?? [])
      .map((s) => ({
        key: String(s.key ?? "").trim() || "section",
        title: String(s.title ?? "").trim(),
        body: String(s.body ?? "").trim(),
      }))
      .filter((s) => s.title && s.body);

    if (sections.length === 0) return null;

    return { sections, sources };
  } catch {
    return null;
  }
}
