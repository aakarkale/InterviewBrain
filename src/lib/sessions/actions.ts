"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import { scoreSession } from "@/lib/ai/scorer";
import { regenerateBrain } from "@/lib/brain/extract";
import { MAX_SESSIONS_PER_MONTH } from "./constants";

export type ActionState = { error: string | null; success?: boolean };

const INTERVIEW_TYPE_VALUES: string[] = INTERVIEW_TYPES.map((t) => t.value);

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function startSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const application_id = field(formData, "application_id");
  const interview_type = field(formData, "interview_type");
  const round_id = field(formData, "round_id");

  if (!application_id) return { error: "Missing application." };
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

  // RLS hides other users' applications, so this also verifies ownership.
  const { data: application } = await supabase
    .from("applications")
    .select("id, is_archived")
    .eq("id", application_id)
    .maybeSingle();

  if (!application) return { error: "Interview not found." };
  if (application.is_archived) {
    return { error: "Unarchive this interview to practice for it." };
  }

  if (round_id) {
    const { data: round } = await supabase
      .from("rounds")
      .select("id, application_id")
      .eq("id", round_id)
      .maybeSingle();
    if (!round || round.application_id !== application_id) {
      return { error: "That round doesn't belong to this interview." };
    }
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      application_id,
      round_id: round_id || null,
      interview_type,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/applications/${application_id}`);
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
    .select("id, application_id, status, transcript")
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
  // regeneration is heavier and the user doesn't need it to read their own
  // session feedback, so it runs after the response (event-driven trigger:
  // session completion).
  await scoreSession(id);
  after(async () => {
    await regenerateBrain();
  });

  revalidatePath(`/sessions/${id}`);
  revalidatePath(`/applications/${session.application_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/brain");
  return { error: null, success: true };
}
