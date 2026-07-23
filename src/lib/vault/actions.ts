"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import {
  actionSuccess,
  field,
  nullableField,
  type ActionState,
} from "@/lib/forms";
import { DOCUMENT_TYPE_VALUES, MAX_ACTIVE_ROLES } from "./constants";
import type { RoundPlanEntry } from "./types";

// ---------------------------------------------------------------- companies

export async function createCompany(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = field(formData, "name");
  if (!name) return { error: "Give the company a name." };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      user_id: user.id,
      name,
      h1b_tracking_enabled: field(formData, "h1b_tracking_enabled") === "on",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a vault for that company." };
    }
    return { error: error.message };
  }

  revalidatePath("/vault");
  revalidatePath("/interviews");
  redirect(`/vault/${data.id}`);
}

export async function updateCompany(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const name = field(formData, "name");
  if (!id) return { error: "Missing company." };
  if (!name) return { error: "Company name can't be empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("companies")
    .update({
      name,
      h1b_tracking_enabled: field(formData, "h1b_tracking_enabled") === "on",
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a vault for that company." };
    }
    return { error: error.message };
  }

  revalidatePath(`/vault/${id}`);
  revalidatePath("/vault");
  return actionSuccess;
}

export async function setCompanyArchived(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  if (!id) return;
  const archived = field(formData, "archived") === "true";
  const { supabase } = await requireUser();
  await supabase.from("companies").update({ is_archived: archived }).eq("id", id);
  revalidatePath(`/vault/${id}`);
  revalidatePath("/vault");
}

export async function deleteCompany(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("companies").delete().eq("id", id);
  revalidatePath("/vault");
  redirect("/vault");
}

// -------------------------------------------------------------------- roles

async function activeRoleCount(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]
): Promise<number> {
  const { count } = await supabase
    .from("roles")
    .select("*", { count: "exact", head: true })
    .eq("is_archived", false);
  return count ?? 0;
}

export async function createRole(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const company_id = field(formData, "company_id");
  const title = field(formData, "title");
  const job_description = field(formData, "job_description");
  const resume = field(formData, "resume");

  if (!company_id) return { error: "Missing company." };
  if (!title) return { error: "Give the role a title." };
  if (!job_description) {
    return { error: "Paste the job description — it drives everything." };
  }
  if (!resume) return { error: "Paste your resume for this role." };

  const { supabase, user } = await requireUser();

  if ((await activeRoleCount(supabase)) >= MAX_ACTIVE_ROLES) {
    return {
      error: `Free plan is capped at ${MAX_ACTIVE_ROLES} active roles. Archive one to add another.`,
    };
  }

  const { data, error } = await supabase
    .from("roles")
    .insert({
      user_id: user.id,
      company_id,
      title,
      job_description,
      resume,
      research_notes: nullableField(formData, "research_notes"),
      linkedin_profile: nullableField(formData, "linkedin_profile"),
      hiring_manager: nullableField(formData, "hiring_manager"),
      team_name: nullableField(formData, "team_name"),
    })
    .select("id, company_id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/vault/${company_id}`);
  redirect(`/vault/${data.company_id}/roles/${data.id}`);
}

export async function updateRole(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const company_id = field(formData, "company_id");
  const title = field(formData, "title");
  const job_description = field(formData, "job_description");
  const resume = field(formData, "resume");

  if (!id || !company_id) return { error: "Missing role." };
  if (!title) return { error: "Role title can't be empty." };
  if (!job_description) return { error: "Job description can't be empty." };
  if (!resume) return { error: "Resume can't be empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("roles")
    .update({
      title,
      job_description,
      resume,
      research_notes: nullableField(formData, "research_notes"),
      linkedin_profile: nullableField(formData, "linkedin_profile"),
      hiring_manager: nullableField(formData, "hiring_manager"),
      team_name: nullableField(formData, "team_name"),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/vault/${company_id}/roles/${id}`);
  revalidatePath(`/vault/${company_id}`);
  return actionSuccess;
}

export async function setRoleArchived(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  const company_id = field(formData, "company_id");
  if (!id) return;
  const archived = field(formData, "archived") === "true";
  const { supabase } = await requireUser();
  await supabase.from("roles").update({ is_archived: archived }).eq("id", id);
  if (company_id) revalidatePath(`/vault/${company_id}/roles/${id}`);
}

export async function deleteRole(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  const company_id = field(formData, "company_id");
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("roles").delete().eq("id", id);
  if (company_id) {
    revalidatePath(`/vault/${company_id}`);
    redirect(`/vault/${company_id}`);
  }
}

// Persist the reusable round plan. The client submits `round_plan` as a JSON
// string of [{name, type}]. Invalid entries are dropped server-side.
export async function updateRoundPlan(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const company_id = field(formData, "company_id");
  if (!id) return { error: "Missing role." };

  let plan: RoundPlanEntry[] = [];
  try {
    const raw = JSON.parse(field(formData, "round_plan") || "[]");
    if (Array.isArray(raw)) {
      plan = raw
        .map((e) => ({
          name: String(e?.name ?? "").trim(),
          type: String(e?.type ?? "other"),
        }))
        .filter((e) => e.name.length > 0);
    }
  } catch {
    return { error: "Couldn't read the round plan." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("roles")
    .update({ round_plan: plan })
    .eq("id", id);

  if (error) return { error: error.message };

  if (company_id) revalidatePath(`/vault/${company_id}/roles/${id}`);
  return actionSuccess;
}

// -------------------------------------------------------------------- documents

export async function createDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role_id = field(formData, "role_id");
  const type = field(formData, "type");
  const title = field(formData, "title");
  const content = field(formData, "content");

  if (!role_id) return { error: "Missing role." };
  if (!DOCUMENT_TYPE_VALUES.includes(type)) return { error: "Pick a document type." };
  if (!title) return { error: "Give the document a title." };
  if (!content) return { error: "Paste the document content." };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("documents").insert({
    role_id,
    user_id: user.id,
    type,
    title,
    content,
  });

  if (error) return { error: error.message };

  // Documents render only on the role page; revalidate the dynamic route.
  revalidatePath("/vault/[companyId]/roles/[roleId]", "page");
  return actionSuccess;
}

export async function updateDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const type = field(formData, "type");
  const title = field(formData, "title");
  const content = field(formData, "content");

  if (!id) return { error: "Missing document." };
  if (!DOCUMENT_TYPE_VALUES.includes(type)) return { error: "Pick a document type." };
  if (!title) return { error: "Give the document a title." };
  if (!content) return { error: "Document content can't be empty." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("documents")
    .update({ type, title, content, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/vault/[companyId]/roles/[roleId]", "page");
  return actionSuccess;
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  if (!id) return;
  const { supabase } = await requireUser();
  await supabase.from("documents").delete().eq("id", id);
  revalidatePath("/vault/[companyId]/roles/[roleId]", "page");
}
