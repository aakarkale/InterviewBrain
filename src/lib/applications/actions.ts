"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { regenerateBrain } from "@/lib/brain/extract";
import {
  DOCUMENT_TYPE_VALUES,
  MAX_ACTIVE_APPLICATIONS,
  ROUND_OUTCOME_VALUES,
  ROUND_TYPE_VALUES,
} from "./constants";

// A logged real-round outcome with notes is brain input (SPEC). When one
// lands, regenerate insights after the response so the brain learns from real
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

export type ActionState = { error: string | null; success?: boolean };

const success: ActionState = { error: null, success: true };

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableField(formData: FormData, key: string): string | null {
  const value = field(formData, key);
  return value.length > 0 ? value : null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// ---------------------------------------------------------------- applications

export async function createApplication(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const company_name = field(formData, "company_name");
  const role_title = field(formData, "role_title");
  const job_description = field(formData, "job_description");
  const resume = field(formData, "resume");

  if (!company_name || !role_title) {
    return { error: "Company and role are both required." };
  }
  if (!job_description) {
    return { error: "Paste the job description — it drives the interview." };
  }
  if (!resume) {
    return { error: "Paste your resume — the interviewer builds on it." };
  }

  const { supabase, user } = await requireUser();

  const { count, error: countError } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false);

  if (countError) return { error: countError.message };
  if ((count ?? 0) >= MAX_ACTIVE_APPLICATIONS) {
    return {
      error: `Free plan is capped at ${MAX_ACTIVE_APPLICATIONS} active interviews. Archive one to add another.`,
    };
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      company_name,
      role_title,
      job_description,
      resume,
      hiring_manager: nullableField(formData, "hiring_manager"),
      team_name: nullableField(formData, "team_name"),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect(`/applications/${data.id}`);
}

export async function updateApplication(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const company_name = field(formData, "company_name");
  const role_title = field(formData, "role_title");
  const job_description = field(formData, "job_description");
  const resume = field(formData, "resume");

  if (!id) return { error: "Missing interview." };
  if (!company_name || !role_title) {
    return { error: "Company and role are both required." };
  }
  if (!job_description) return { error: "Job description can't be empty." };
  if (!resume) return { error: "Resume can't be empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("applications")
    .update({
      company_name,
      role_title,
      job_description,
      resume,
      hiring_manager: nullableField(formData, "hiring_manager"),
      team_name: nullableField(formData, "team_name"),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
  return success;
}

export async function setApplicationArchived(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  if (!id) return;
  const archived = field(formData, "archived") === "true";

  const { supabase } = await requireUser();
  await supabase
    .from("applications")
    .update({ is_archived: archived })
    .eq("id", id);

  revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
}

// ----------------------------------------------------------------------- rounds

export async function createRound(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const application_id = field(formData, "application_id");
  const round_type = field(formData, "round_type");
  const outcome = field(formData, "outcome") || "upcoming";
  const round_number = Number(formData.get("round_number"));

  if (!application_id) return { error: "Missing interview." };
  if (!ROUND_TYPE_VALUES.includes(round_type)) {
    return { error: "Pick a round type." };
  }
  if (!ROUND_OUTCOME_VALUES.includes(outcome)) {
    return { error: "Pick an outcome." };
  }
  if (!Number.isInteger(round_number) || round_number < 1) {
    return { error: "Round number must be a positive whole number." };
  }

  const post_round_notes = nullableField(formData, "post_round_notes");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("rounds").insert({
    application_id,
    round_number,
    round_type,
    outcome,
    interviewer_name: nullableField(formData, "interviewer_name"),
    interviewer_role: nullableField(formData, "interviewer_role"),
    scheduled_date: nullableField(formData, "scheduled_date"),
    post_round_notes,
  });

  if (error) return { error: error.message };

  // Post-round notes are brain input: a logged real outcome regenerates the
  // brain (event-driven trigger, per the locked decision).
  maybeRegenerateBrain(outcome, post_round_notes);
  revalidatePath(`/applications/${application_id}`);
  revalidatePath("/brain");
  return success;
}

export async function updateRound(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const application_id = field(formData, "application_id");
  const round_type = field(formData, "round_type");
  const outcome = field(formData, "outcome") || "upcoming";
  const round_number = Number(formData.get("round_number"));

  if (!id || !application_id) return { error: "Missing round." };
  if (!ROUND_TYPE_VALUES.includes(round_type)) {
    return { error: "Pick a round type." };
  }
  if (!ROUND_OUTCOME_VALUES.includes(outcome)) {
    return { error: "Pick an outcome." };
  }
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
      outcome,
      interviewer_name: nullableField(formData, "interviewer_name"),
      interviewer_role: nullableField(formData, "interviewer_role"),
      scheduled_date: nullableField(formData, "scheduled_date"),
      post_round_notes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  maybeRegenerateBrain(outcome, post_round_notes);
  revalidatePath(`/applications/${application_id}`);
  revalidatePath("/brain");
  return success;
}

export async function deleteRound(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  const application_id = field(formData, "application_id");
  if (!id) return;

  const { supabase } = await requireUser();
  await supabase.from("rounds").delete().eq("id", id);
  if (application_id) revalidatePath(`/applications/${application_id}`);
}

// -------------------------------------------------------------------- documents

export async function createDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const application_id = field(formData, "application_id");
  const type = field(formData, "type");
  const title = field(formData, "title");
  const content = field(formData, "content");

  if (!application_id) return { error: "Missing interview." };
  if (!DOCUMENT_TYPE_VALUES.includes(type)) {
    return { error: "Pick a document type." };
  }
  if (!title) return { error: "Give the document a title." };
  if (!content) return { error: "Paste the document content." };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("documents").insert({
    application_id,
    type,
    title,
    content,
  });

  if (error) return { error: error.message };

  revalidatePath(`/applications/${application_id}`);
  return success;
}

export async function updateDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const application_id = field(formData, "application_id");
  const type = field(formData, "type");
  const title = field(formData, "title");
  const content = field(formData, "content");

  if (!id || !application_id) return { error: "Missing document." };
  if (!DOCUMENT_TYPE_VALUES.includes(type)) {
    return { error: "Pick a document type." };
  }
  if (!title) return { error: "Give the document a title." };
  if (!content) return { error: "Document content can't be empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("documents")
    .update({ type, title, content, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/applications/${application_id}`);
  return success;
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  const application_id = field(formData, "application_id");
  if (!id) return;

  const { supabase } = await requireUser();
  await supabase.from("documents").delete().eq("id", id);
  if (application_id) revalidatePath(`/applications/${application_id}`);
}
