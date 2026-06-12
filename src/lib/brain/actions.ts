"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { regenerateBrain } from "./extract";
import { scoreSession } from "@/lib/ai/scorer";

export type ActionState = { error: string | null; success?: boolean };

// Manual refresh (SPEC: event-driven regeneration plus a manual refresh).
// Awaited inline so the page reflects the new insights on reload.
export async function refreshBrain(): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ok = await regenerateBrain();
  if (!ok) {
    return { error: "Couldn't refresh insights just now. Try again shortly." };
  }
  revalidatePath("/brain");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

// Re-score a completed session whose first scoring attempt failed (or to
// refresh feedback). Also refreshes the brain since scores feed it.
export async function rescoreSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing session." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ok = await scoreSession(id);
  if (!ok) {
    return { error: "Scoring failed. Try again in a moment." };
  }
  await regenerateBrain();
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/brain");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
