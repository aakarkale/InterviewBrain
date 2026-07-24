"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { field, type ActionState } from "@/lib/forms";
import { anthropic, MODEL } from "@/lib/ai/client";
import { MAX_COMPANY_INSIGHT_GENERATIONS_PER_MONTH } from "./constants";
import { generateCompanyInsights } from "./company-insights";
import { generateRoleAlignment } from "./role-alignment";

// Cheap deterministic fingerprint so we don't re-run (and re-bill) a generator
// when its inputs are unchanged.
function fingerprint(...parts: (string | boolean | null | undefined)[]): string {
  const s = parts.map((p) => String(p ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// --------------------------------------------------------- company insights

export async function generateCompanyInsightsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const company_id = field(formData, "company_id");
  const force = field(formData, "force") === "true";
  if (!company_id) return { error: "Missing company." };

  const { supabase } = await requireUser();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, h1b_tracking_enabled, insights, insights_generated_at, insights_input_fingerprint")
    .eq("id", company_id)
    .maybeSingle();
  if (!company) return { error: "Company not found." };

  const fp = fingerprint(company.name, company.h1b_tracking_enabled);
  if (!force && company.insights && company.insights_input_fingerprint === fp) {
    return { error: null, success: true }; // already fresh
  }

  // Monthly cost guard (web search is billed). A company already generated this
  // month can be refreshed; otherwise cap the number of distinct companies.
  const monthStart = monthStartISO();
  const already =
    company.insights_generated_at !== null &&
    company.insights_generated_at >= monthStart;
  if (!already) {
    const { count } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .gte("insights_generated_at", monthStart);
    if ((count ?? 0) >= MAX_COMPANY_INSIGHT_GENERATIONS_PER_MONTH) {
      return {
        error: `Monthly company-insight limit reached (${MAX_COMPANY_INSIGHT_GENERATIONS_PER_MONTH}). Resets on the 1st.`,
      };
    }
  }

  const result = await generateCompanyInsights({
    companyName: company.name,
    h1bEnabled: company.h1b_tracking_enabled,
  });
  if (!result) {
    return { error: "Couldn't generate insights right now — try again." };
  }

  const generated_at = new Date().toISOString();
  const { error } = await supabase
    .from("companies")
    .update({
      insights: { ...result, generated_at },
      insights_generated_at: generated_at,
      insights_input_fingerprint: fp,
    })
    .eq("id", company_id);
  if (error) return { error: error.message };

  revalidatePath(`/vault/${company_id}`);
  return { error: null, success: true };
}

// ----------------------------------------------------------- role alignment

export async function generateRoleAlignmentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role_id = field(formData, "role_id");
  const force = field(formData, "force") === "true";
  if (!role_id) return { error: "Missing role." };

  const { supabase } = await requireUser();
  const { data: role } = await supabase
    .from("roles")
    .select(
      "id, company_id, title, job_description, resume, linkedin_profile, research_notes, alignment, alignment_input_fingerprint, companies(name)"
    )
    .eq("id", role_id)
    .maybeSingle();
  if (!role) return { error: "Role not found." };

  const fp = fingerprint(
    role.job_description,
    role.resume,
    role.linkedin_profile,
    role.research_notes
  );
  if (!force && role.alignment && role.alignment_input_fingerprint === fp) {
    return { error: null, success: true };
  }

  const companyName = (role.companies as { name: string } | null)?.name ?? "the company";
  const result = await generateRoleAlignment({
    companyName,
    roleTitle: role.title,
    jobDescription: role.job_description,
    resume: role.resume,
    linkedin: role.linkedin_profile,
    research: role.research_notes,
  });
  if (!result) return { error: "Couldn't analyze alignment right now — try again." };

  const generated_at = new Date().toISOString();
  const { error } = await supabase
    .from("roles")
    .update({
      alignment: { ...result, sources: [], generated_at },
      alignment_generated_at: generated_at,
      alignment_input_fingerprint: fp,
    })
    .eq("id", role_id);
  if (error) return { error: error.message };

  revalidatePath("/vault/[companyId]/roles/[roleId]", "page");
  return { error: null, success: true };
}

// ----------------------------------------------------------- PDF extraction

const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Shared: send an uploaded PDF as a base64 document block and pull clean plain
// text back out. Callers pass a content-specific instruction. Never stores the
// binary — only the extracted text is returned for the user to review.
async function extractPdfText(
  formData: FormData,
  instruction: string,
  softFail: string
): Promise<{ error: string | null; text?: string }> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file first." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { error: "That doesn't look like a PDF." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "That PDF is too large (max 10MB)." };
  }

  try {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: b64 },
            },
            { type: "text", text: instruction },
          ],
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return { error: "Couldn't read any text from that PDF." };
    return { error: null, text };
  } catch {
    return { error: softFail };
  }
}

// Extract readable text from an uploaded LinkedIn "Save to PDF" export.
export async function extractLinkedinPdfAction(
  _prev: { error: string | null; text?: string },
  formData: FormData
): Promise<{ error: string | null; text?: string }> {
  return extractPdfText(
    formData,
    "Extract the readable text of this LinkedIn profile as clean plain text (headline, about, experience, education, skills). No commentary, just the profile content.",
    "Couldn't process that PDF — paste your profile text instead."
  );
}

// Extract readable text from an uploaded resume PDF.
export async function extractResumePdfAction(
  _prev: { error: string | null; text?: string },
  formData: FormData
): Promise<{ error: string | null; text?: string }> {
  return extractPdfText(
    formData,
    "Extract the full readable text of this resume as clean plain text — preserve section headings, job titles, companies, dates, bullet points, and skills, in reading order. No commentary, just the resume content.",
    "Couldn't process that PDF — paste your resume text instead."
  );
}

// Save reviewed LinkedIn text onto the role (used by the upload widget after the
// user edits the extracted text).
export async function saveRoleLinkedin(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role_id = field(formData, "role_id");
  const company_id = field(formData, "company_id");
  if (!role_id) return { error: "Missing role." };
  const linkedin_profile = String(formData.get("linkedin_profile") ?? "").trim() || null;

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("roles")
    .update({ linkedin_profile })
    .eq("id", role_id);
  if (error) return { error: error.message };

  if (company_id) revalidatePath(`/vault/${company_id}/roles/${role_id}`);
  return { error: null, success: true };
}

// Save reviewed resume text onto the role. Resume is required for the role, so
// this only overwrites when non-empty text is provided.
export async function saveRoleResume(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role_id = field(formData, "role_id");
  const company_id = field(formData, "company_id");
  if (!role_id) return { error: "Missing role." };
  const resume = String(formData.get("resume") ?? "").trim();
  if (!resume) return { error: "Nothing to save — the resume text is empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("roles").update({ resume }).eq("id", role_id);
  if (error) return { error: error.message };

  if (company_id) revalidatePath(`/vault/${company_id}/roles/${role_id}`);
  return { error: null, success: true };
}
