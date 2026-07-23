import type { Tables } from "@/lib/supabase/database.types";

// Plain types + helpers, safe to import from Client Components (no server-only
// dependency). Keep data-fetching in queries.ts, which imports the server
// client and must never reach a client bundle.

export type Story = Tables<"stories">;
export type Competency = Tables<"competencies">;

// An AI-shaped story (drafted from a session answer) before the user edits and
// saves it. Lives here — not in the server-only draft module — so Client
// Components can hold it in state.
export type StoryDraft = {
  title: string;
  content: string;
  competency_tags: string[];
};

// competency_tags is stored as a jsonb array of competency id strings.
// Only this field is read, so any row carrying it (incl. partial selects) works.
export function storyTags(story: Pick<Story, "competency_tags">): string[] {
  return Array.isArray(story.competency_tags)
    ? (story.competency_tags as unknown[]).filter(
        (t): t is string => typeof t === "string"
      )
    : [];
}
