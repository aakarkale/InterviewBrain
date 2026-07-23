"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { field, type ActionState } from "@/lib/forms";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import { scoreSession } from "@/lib/ai/scorer";
import { regenerateBrain } from "@/lib/brain/extract";
import { MAX_SESSIONS_PER_MONTH } from "./constants";

export type { ActionState };

const INTERVIEW_TYPE_VALUES: string[] = INTERVIEW_TYPES.map((t) => t.value);
const INTERVIEW_ROUTE = "/interviews/[companyId]/roles/[roleId]/[interviewId]";

export async function startSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const interview_id = field(formData, "interview_id");
  const interview_type = field(formData, "interview_type");
  const round_id = field(formData, "round_id");

  if (!interview_id) return { error: "Missing interview." };
  if (!INTERVIEW_TYPE_VALUES.includes(interview_type)) {
    return { error: "Pick an interview type." };
  }

  const { supabase, user } = await requireUser();

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const { count, error: countError } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  if (countError) return { error: countError.message };
  if ((count ?? 0) >= MAX_SESSIONS_PER_MONTH) {
    return {
      error: `Free plan is capped at ${MAX_SESSIONS_PER_MONTH} practice sessions per month. Your cap resets on the 1st.`,
    };
  }

  // RLS hides other users' interviews, so this also verifies ownership.
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, roles(is_archived)")
    .eq("id", interview_id)
    .maybeSingle();

  if (!interview) return { error: "Interview not found." };
  const roleRel = interview.roles as { is_archived: boolean } | null;
  if (roleRel?.is_archived) {
    return { error: "Unarchive this role to practice for it." };
  }

  if (round_id) {
    const { data: round } = await supabase
      .from("rounds")
      .select("id, interview_id")
      .eq("id", round_id)
      .maybeSingle();
    if (!round || round.interview_id !== interview_id) {
      return { error: "That round doesn't belong to this interview." };
    }
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      interview_id,
      round_id: round_id || null,
      interview_type,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(INTERVIEW_ROUTE, "page");
  redirect(`/sessions/${session.id}`);
}

export async function completeSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  if (!id) return { error: "Missing session." };

  const { supabase } = await requireUser();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return { error: "Session not found." };
  if (session.status !== "in_progress") {
    return { error: null, success: true };
  }

  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  // Score inline so the feedback view has results on first load. Brain
  // regeneration is heavier and runs after the response.
  await scoreSession(id);
  after(async () => {
    await regenerateBrain();
  });

  revalidatePath(`/sessions/${id}`);
  revalidatePath(INTERVIEW_ROUTE, "page");
  revalidatePath("/dashboard");
  revalidatePath("/brain");
  return { error: null, success: true };
}
