"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null; success?: boolean };

const success: ActionState = { error: null, success: true };

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

// Keep only ids that exist in the seeded competency taxonomy, so the brain can
// rely on every tag resolving to a real slug.
async function validTagIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tags: string[]
): Promise<string[]> {
  const unique = [...new Set(tags)];
  if (unique.length === 0) return [];
  const { data } = await supabase
    .from("competencies")
    .select("id")
    .in("id", unique);
  const valid = new Set((data ?? []).map((r) => r.id));
  return unique.filter((t) => valid.has(t));
}

export async function createStory(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const title = field(formData, "title");
  const content = field(formData, "content");
  const tags = formData.getAll("competency_tags").map(String);

  if (!title) return { error: "Give the story a title." };
  if (!content) {
    return {
      error: "Add the story — Situation, Task, Action, Result.",
    };
  }

  const { supabase, user } = await requireUser();
  const competency_tags = await validTagIds(supabase, tags);

  const { error } = await supabase
    .from("stories")
    .insert({ user_id: user.id, title, content, competency_tags });

  if (error) return { error: error.message };

  revalidatePath("/stories");
  return success;
}

export async function updateStory(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = field(formData, "id");
  const title = field(formData, "title");
  const content = field(formData, "content");
  const tags = formData.getAll("competency_tags").map(String);

  if (!id) return { error: "Missing story." };
  if (!title) return { error: "Give the story a title." };
  if (!content) return { error: "Story content can't be empty." };

  const { supabase } = await requireUser();
  const competency_tags = await validTagIds(supabase, tags);

  const { error } = await supabase
    .from("stories")
    .update({
      title,
      content,
      competency_tags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/stories");
  return success;
}

export async function deleteStory(formData: FormData): Promise<void> {
  const id = field(formData, "id");
  if (!id) return;

  const { supabase } = await requireUser();
  await supabase.from("stories").delete().eq("id", id);
  revalidatePath("/stories");
}
