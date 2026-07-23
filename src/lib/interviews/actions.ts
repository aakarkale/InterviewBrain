"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import {
  actionSuccess,
  field,
  nullableField,
  type ActionState,
} from "@/lib/forms";
import { regenerateBrain } from "@/lib/brain/extract";
import {
  INTERVIEW_STATUS_VALUES,
  ROUND_OUTCOME_VALUES,
  ROUND_TYPE_VALUES,
} from "@/lib/vault/constants";
import { roundPlan } from "@/lib/vault/types";

const INTERVIEW_ROUTE = "/interviews/[companyId]/roles/[roleId]/[interviewId]";
const ROUND_ROUTE = `${INTERVIEW_ROUTE}/rounds/[roundId]`;

// A logged real-round outcome with notes is brain input (SPEC). When one lands,
// regenerate insights after the response so the brain learns from real
// interviews, not just practice.
function maybeRegenerateBrain(outcome: string, notes: string | null) {
  const isRealSignal =
    outcome !== "upcoming" && notes !== null && notes.trim().length > 0;
  if (isRealSignal) {
    after(async () => {
      await regenerateBrain();
    });
  }
}

// -------------------------------------------------------------- interviews

// Create an interview for a role and snapshot its rounds from the role's round
// plan (a copy, so later plan edits never mutate a historical interview).
export async function createInterview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role_id = field(formData, "role_id");
  const label = field(formData, "label") || "Interview";
  if (!role_id) return { error: "Missing role." };

  const { supabase, user } = await requireUser();

  const { data: role } = await supabase
    .from("roles")
    .select("id, company_id, round_plan")
    .eq("id", role_id)
    .maybeSingle();
  if (!role) return { error: "Role not found." };

  const { data: interview, error } = await supabase
    .from("interviews")
    .insert({ user_id: user.id, role_id, label })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const plan = roundPlan(role);
  if (plan.length > 0) {
    const rows = plan.map((entry, i) => ({
      interview_id: interview.id,
      user_id: user.id,
      round_number: i + 1,
      round_name: entry.name,
      round_type: ROUND_TYPE_VALUES.includes(entry.type) ? entry.type : "other",
      outcome: "upcoming",
    }));
    await supabase.from("rounds").insert(rows);
  }

  revalidatePath("/interviews");
  redirect(`/interviews/${role.company_id}/roles/${role_id}/${interview.id}`);
}

export async function updateInterview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const label = field(formData, "label") || "Interview";
  const status = field(formData, "status") || "active";
  if (!id) return { error: "Missing interview." };
  if (!INTERVIEW_STATUS_VALUES.includes(status)) {
    return { error: "Pick a valid status." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("interviews")
    .update({ label, status, scheduled_date: nullableField(formData, "scheduled_date") })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(INTERVIEW_ROUTE, "page");
  revalidatePath("/interviews");
  return actionSuccess;
}

export async function deleteInterview(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  const back = field(formData, "back");
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("interviews").delete().eq("id", id);
  revalidatePath("/interviews");
  if (back) redirect(back);
}

// ------------------------------------------------------------------ rounds

export async function createRound(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const interview_id = field(formData, "interview_id");
  const round_type = field(formData, "round_type");
  const round_name = field(formData, "round_name") || null;
  const outcome = field(formData, "outcome") || "upcoming";
  const round_number = Number(formData.get("round_number"));

  if (!interview_id) return { error: "Missing interview." };
  if (!ROUND_TYPE_VALUES.includes(round_type)) return { error: "Pick a round type." };
  if (!ROUND_OUTCOME_VALUES.includes(outcome)) return { error: "Pick an outcome." };
  if (!Number.isInteger(round_number) || round_number < 1) {
    return { error: "Round number must be a positive whole number." };
  }

  const { supabase, user } = await requireUser();
  const post_round_notes = nullableField(formData, "post_round_notes");
  const { error } = await supabase.from("rounds").insert({
    interview_id,
    user_id: user.id,
    round_number,
    round_type,
    round_name,
    outcome,
    interviewer_name: nullableField(formData, "interviewer_name"),
    interviewer_role: nullableField(formData, "interviewer_role"),
    scheduled_date: nullableField(formData, "scheduled_date"),
    post_round_notes,
  });

  if (error) return { error: error.message };

  maybeRegenerateBrain(outcome, post_round_notes);
  revalidatePath(INTERVIEW_ROUTE, "page");
  revalidatePath("/brain");
  return actionSuccess;
}

export async function updateRound(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const round_type = field(formData, "round_type");
  const round_name = field(formData, "round_name") || null;
  const outcome = field(formData, "outcome") || "upcoming";
  const round_number = Number(formData.get("round_number"));

  if (!id) return { error: "Missing round." };
  if (!ROUND_TYPE_VALUES.includes(round_type)) return { error: "Pick a round type." };
  if (!ROUND_OUTCOME_VALUES.includes(outcome)) return { error: "Pick an outcome." };
  if (!Number.isInteger(round_number) || round_number < 1) {
    return { error: "Round number must be a positive whole number." };
  }

  const post_round_notes = nullableField(formData, "post_round_notes");
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("rounds")
    .update({
      round_number,
      round_type,
      round_name,
      outcome,
      interviewer_name: nullableField(formData, "interviewer_name"),
      interviewer_role: nullableField(formData, "interviewer_role"),
      scheduled_date: nullableField(formData, "scheduled_date"),
      post_round_notes,
      transcript: nullableField(formData, "transcript"),
      summary: nullableField(formData, "summary"),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  maybeRegenerateBrain(outcome, post_round_notes);
  revalidatePath(INTERVIEW_ROUTE, "page");
  revalidatePath(ROUND_ROUTE, "page");
  revalidatePath("/brain");
  return actionSuccess;
}

export async function deleteRound(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  const back = field(formData, "back");
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("rounds").delete().eq("id", id);
  revalidatePath(INTERVIEW_ROUTE, "page");
  if (back) redirect(back);
}
