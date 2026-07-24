import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODEL } from "@/lib/ai/client";
import type { RequirementCoverage } from "@/lib/vault/types";

const MAX_CHARS = 8000;
const clip = (t: string) =>
  t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS)}\n…(truncated)` : t;

const textOf = (r: Anthropic.Message) =>
  r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

const clampArr = (a: unknown): string[] =>
  Array.isArray(a) ? a.map((x) => String(x)).filter(Boolean) : [];

export type RoleAlignmentResult = {
  fit_score: number;
  summary: string;
  requirements: RequirementCoverage[];
  keyword_gaps: string[];
  strengths: string[];
  gaps: string[];
  talking_points: string[];
  actions: string[];
};

// Structured JD requirements from step 1, fed into the matching pass.
type ParsedJob = {
  must_haves: string[];
  nice_to_haves: string[];
  hard_skills: string[];
  responsibilities: string[];
};

// ------------------------------------------------------------- step 1: parse JD
// Break the JD into requirement buckets so the matching pass reasons against a
// clean checklist instead of prose — this is what makes coverage per-requirement
// and the ATS-style keyword list reliable.
async function parseJob(
  roleTitle: string,
  jobDescription: string
): Promise<ParsedJob | null> {
  try {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        must_haves: {
          type: "array",
          items: { type: "string" },
          description:
            "Non-negotiable requirements (years, ownership, domains, degrees). Each a short, checkable phrase.",
        },
        nice_to_haves: {
          type: "array",
          items: { type: "string" },
          description: "Preferred / bonus qualifications, each a short phrase.",
        },
        hard_skills: {
          type: "array",
          items: { type: "string" },
          description:
            "Concrete ATS-style keywords: tools, technologies, methodologies, domains, certifications named in the JD.",
        },
        responsibilities: {
          type: "array",
          items: { type: "string" },
          description: "The main things this person will actually do, each a short phrase.",
        },
      },
      required: ["must_haves", "nice_to_haves", "hard_skills", "responsibilities"],
    };

    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: `You extract a structured requirement checklist from a job description. Only capture what the JD actually states — never invent requirements. Keep each item short and checkable.`,
      messages: [
        {
          role: "user",
          content: `Extract the requirement checklist for this "${roleTitle}" job description.

${clip(jobDescription)}`,
        },
      ],
    });

    const parsed = JSON.parse(textOf(response)) as Partial<ParsedJob>;
    return {
      must_haves: clampArr(parsed.must_haves),
      nice_to_haves: clampArr(parsed.nice_to_haves),
      hard_skills: clampArr(parsed.hard_skills),
      responsibilities: clampArr(parsed.responsibilities),
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------- step 2: evidence match
// Match the candidate's material against the parsed checklist. Every requirement
// gets a coverage verdict backed by a concrete piece of evidence (or flagged
// missing), which drives the honest fit score and the actionable insights.
export async function generateRoleAlignment(input: {
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resume: string;
  linkedin?: string | null;
  research?: string | null;
}): Promise<RoleAlignmentResult | null> {
  try {
    const parsed = await parseJob(input.roleTitle, input.jobDescription);

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        fit_score: {
          type: "integer",
          description:
            "0–100. Weight must-haves heavily, nice-to-haves lightly. Missing must-haves should pull the score down hard. Be honest; a weak match is a low score.",
        },
        summary: {
          type: "string",
          description: "2–3 sentence read on overall fit, grounded in the coverage below.",
        },
        requirements: {
          type: "array",
          description:
            "One entry per meaningful must-have and nice-to-have, most important first.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              requirement: {
                type: "string",
                description: "The requirement, restated concisely.",
              },
              coverage: {
                type: "string",
                enum: ["strong", "partial", "missing"],
                description:
                  "strong = clearly evidenced; partial = related but thin or adjacent; missing = no evidence.",
              },
              evidence: {
                type: "string",
                description:
                  "The specific resume/LinkedIn detail behind the verdict, or what's absent if missing. One short sentence.",
              },
            },
            required: ["requirement", "coverage", "evidence"],
          },
        },
        keyword_gaps: {
          type: "array",
          items: { type: "string" },
          description:
            "Hard skills / ATS keywords named in the JD that do NOT appear in the resume. Empty if none.",
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description: "The candidate's strongest overlaps with this role, each citing a concrete detail.",
        },
        gaps: {
          type: "array",
          items: { type: "string" },
          description: "The most consequential gaps or stretches vs the JD.",
        },
        talking_points: {
          type: "array",
          items: { type: "string" },
          description: "Things to emphasize or proactively address in the interview.",
        },
        actions: {
          type: "array",
          items: { type: "string" },
          description:
            "Concrete, resume-specific steps to close gaps or sharpen the match (e.g. add a keyword the candidate genuinely has, quantify an outcome, reframe a bullet). Never suggest fabricating experience.",
        },
      },
      required: [
        "fit_score",
        "summary",
        "requirements",
        "keyword_gaps",
        "strengths",
        "gaps",
        "talking_points",
        "actions",
      ],
    };

    const checklist = parsed
      ? `## Requirement checklist (extracted from the JD)
Must-haves:
${parsed.must_haves.map((x) => `- ${x}`).join("\n") || "- (none extracted)"}

Nice-to-haves:
${parsed.nice_to_haves.map((x) => `- ${x}`).join("\n") || "- (none extracted)"}

Hard skills / ATS keywords:
${parsed.hard_skills.map((x) => `- ${x}`).join("\n") || "- (none extracted)"}

Key responsibilities:
${parsed.responsibilities.map((x) => `- ${x}`).join("\n") || "- (none extracted)"}
`
      : "";

    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: `You are an expert technical recruiter grading how well a candidate matches a specific role. Work only from the material provided — resume, LinkedIn, research, and the extracted requirement checklist. Never credit experience the candidate doesn't demonstrate, and never invent evidence. For every requirement, find the concrete supporting detail or mark it missing. Keyword gaps are strictly terms the JD names that the resume does not contain. Be specific and honest — a real gap surfaced is worth more than flattery, and your actions must be things this candidate could truthfully do, never fabrication.`,
      messages: [
        {
          role: "user",
          content: `Grade the fit for the ${input.roleTitle} role at ${input.companyName}.
${checklist ? `\n${checklist}` : ""}
## Job description
${clip(input.jobDescription)}

## Candidate resume
${clip(input.resume)}
${input.linkedin ? `\n## Candidate LinkedIn profile\n${clip(input.linkedin)}` : ""}
${input.research ? `\n## Candidate research notes\n${clip(input.research)}` : ""}`,
        },
      ],
    });

    const result = JSON.parse(textOf(response)) as Partial<RoleAlignmentResult>;

    const summary = String(result.summary ?? "").trim();
    if (!summary) return null;

    const fit = Math.max(0, Math.min(100, Math.round(Number(result.fit_score) || 0)));

    const requirements: RequirementCoverage[] = Array.isArray(result.requirements)
      ? result.requirements
          .map((r) => {
            const requirement = String((r as RequirementCoverage)?.requirement ?? "").trim();
            const raw = String((r as RequirementCoverage)?.coverage ?? "");
            const coverage: RequirementCoverage["coverage"] =
              raw === "strong" || raw === "partial" || raw === "missing" ? raw : "partial";
            const evidence = String((r as RequirementCoverage)?.evidence ?? "").trim();
            return requirement ? { requirement, coverage, evidence } : null;
          })
          .filter((r): r is RequirementCoverage => r !== null)
      : [];

    return {
      fit_score: fit,
      summary,
      requirements,
      keyword_gaps: clampArr(result.keyword_gaps),
      strengths: clampArr(result.strengths),
      gaps: clampArr(result.gaps),
      talking_points: clampArr(result.talking_points),
      actions: clampArr(result.actions),
    };
  } catch {
    return null;
  }
}
