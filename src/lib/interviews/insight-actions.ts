"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { field, type ActionState } from "@/lib/forms";
import { roundPlan } from "@/lib/vault/types";
import { generateInterviewPrep } from "./prep";
import { generateRoundCoaching } from "./round-coaching";

const INTERVIEW_ROUTE = "/interviews/[companyId]/roles/[roleId]/[interviewId]";
const ROUND_ROUTE = `${INTERVIEW_ROUTE}/rounds/[roundId]`;

function fingerprint(...parts: (string | null | undefined)[]): string {
  const s = parts.map((p) => String(p ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// -------------------------------------------------------------- interview prep

export async function generateInterviewPrepAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const interview_id = field(formData, "interview_id");
  const force = field(formData, "force") === "true";
  if (!interview_id) return { error: "Missing interview." };

  const { supabase } = await requireUser();
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, role_id, prep, prep_input_fingerprint")
    .eq("id", interview_id)
    .maybeSingle();
  if (!interview) return { error: "Interview not found." };

  const { data: role } = await supabase
    .from("roles")
    .select("id, title, job_description, resume, round_plan, company_id, companies(name)")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return { error: "Role not found." };

  const [{ data: documents }, { data: rounds }] = await Promise.all([
    supabase.from("documents").select("title, type, content").eq("role_id", role.id),
    supabase
      .from("rounds")
      .select("post_round_notes")
      .eq("interview_id", interview_id),
  ]);

  const priorNotes = (rounds ?? [])
    .map((r) => r.post_round_notes)
    .filter((n): n is string => Boolean(n && n.trim()));

  const fp = fingerprint(
    role.job_description,
    role.resume,
    JSON.stringify(role.round_plan),
    (documents ?? []).map((d) => d.title).join(","),
    priorNotes.join("|")
  );
  if (!force && interview.prep && interview.prep_input_fingerprint === fp) {
    return { error: null, success: true };
  }

  const result = await generateInterviewPrep({
    companyName: (role.companies as { name: string } | null)?.name ?? "the company",
    roleTitle: role.title,
    jobDescription: role.job_description,
    resume: role.resume,
    roundPlan: roundPlan(role),
    documents: documents ?? [],
    priorNotes,
  });
  if (!result) return { error: "Couldn't build prep right now — try again." };

  const generated_at = new Date().toISOString();
  const { error } = await supabase
    .from("interviews")
    .update({
      prep: { ...result, sources: [], generated_at },
      prep_generated_at: generated_at,
      prep_input_fingerprint: fp,
    })
    .eq("id", interview_id);
  if (error) return { error: error.message };

  revalidatePath(INTERVIEW_ROUTE, "page");
  return { error: null, success: true };
}

// ------------------------------------------------------------- round coaching

export async function generateRoundCoachingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const round_id = field(formData, "round_id");
  if (!round_id) return { error: "Missing round." };

  const { supabase } = await requireUser();
  const { data: round } = await supabase
    .from("rounds")
    .select(
      "id, interview_id, round_name, round_type, outcome, post_round_notes, transcript, summary, round_number"
    )
    .eq("id", round_id)
    .maybeSingle();
  if (!round || !round.interview_id) return { error: "Round not found." };

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, role_id")
    .eq("id", round.interview_id)
    .maybeSingle();
  if (!interview) return { error: "Interview not found." };

  const { data: role } = await supabase
    .from("roles")
    .select("title, companies(name)")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return { error: "Role not found." };

  const { data: priors } = await supabase
    .from("rounds")
    .select("round_name, round_type, outcome, post_round_notes, summary")
    .eq("interview_id", round.interview_id)
    .lt("round_number", round.round_number)
    .order("round_number", { ascending: true });

  const result = await generateRoundCoaching({
    companyName: (role.companies as { name: string } | null)?.name ?? "the company",
    roleTitle: role.title,
    round: {
      name: round.round_name ?? round.round_type,
      type: round.round_type,
      outcome: round.outcome,
      notes: round.post_round_notes,
      transcript: round.transcript,
      summary: round.summary,
    },
    priorRounds: (priors ?? []).map((p) => ({
      name: p.round_name ?? p.round_type,
      outcome: p.outcome,
      notes: p.post_round_notes,
      summary: p.summary,
    })),
  });
  if (!result) {
    return { error: "Add notes, a transcript, or a summary first — then I can coach you." };
  }

  const generated_at = new Date().toISOString();
  const { error } = await supabase
    .from("rounds")
    .update({
      coaching: { ...result, generated_at },
      coaching_generated_at: generated_at,
    })
    .eq("id", round_id);
  if (error) return { error: error.message };

  revalidatePath(ROUND_ROUTE, "page");
  return { error: null, success: true };
}
