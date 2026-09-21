import { createClient } from "@/lib/db/server";
import type { Competency, Story } from "./types";

export type { Competency, Story } from "./types";
export { storyTags } from "./types";

// RLS scopes stories to the authenticated owner. Competencies are the shared
// seed taxonomy, readable by any authenticated user.

export async function getStories(): Promise<Story[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCompetencies(): Promise<Competency[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("competencies")
    .select("*")
    .order("interview_type", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
