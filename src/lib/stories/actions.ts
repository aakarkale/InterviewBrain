"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseTranscript } from "@/lib/sessions/constants";
import { draftStoryFromAnswer } from "./draft";
import type { StoryDraft } from "./types";

export type ActionState = { error: string | null; success?: boolean };

// Number of follow-up (interviewer question, candidate answer) pairs after the
// selected answer to feed the drafter — enough to catch a probed-for result
// without dragging in the next, unrelated question.
const MAX_FOLLOW_UPS = 2;

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
  const sourceSessionId = field(formData, "source_session_id");

  if (!title) return { error: "Give the story a title." };
  if (!content) {
    return {
      error: "Add the story — Situation, Task, Action, Result.",
    };
  }

  const { supabase, user } = await requireUser();
  const competency_tags = await validTagIds(supabase, tags);
  // RLS scopes sessions to the owner, so this select both resolves the id and
  // proves it belongs to this user — a stray/foreign id simply falls to null.
  const source_session_id = sourceSessionId
    ? ((
        await supabase
          .from("sessions")
          .select("id")
          .eq("id", sourceSessionId)
          .maybeSingle()
      ).data?.id ?? null)
    : null;

  const { error } = await supabase
    .from("stories")
    .insert({ user_id: user.id, title, content, competency_tags, source_session_id });

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

export type DraftState = { error: string | null; draft?: StoryDraft };

// Draft a reusable STAR story from one candidate answer in a completed
// behavioral session. Called directly from the feedback view (not via a form
// action) so each answer can draft independently. Returns the draft for the
// user to edit before saving via createStory.
export async function draftStoryFromSession(
  sessionId: string,
  answerIndex: number
): Promise<DraftState> {
  if (!sessionId) return { error: "Missing session." };

  const { supabase } = await requireUser();

  // RLS returns only the owner's session.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, interview_type, transcript")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { error: "Session not found." };
  if (session.interview_type !== "behavioral") {
    return { error: "Stories are drafted from behavioral sessions." };
  }

  const transcript = parseTranscript(session.transcript);
  const target = transcript[answerIndex];
  if (!target || target.role !== "user" || !target.content.trim()) {
    return { error: "Pick one of your answers to save." };
  }

  // The interviewer question this answer responded to (nearest prior assistant
  // turn) anchors the story; the answer itself is the raw material.
  let question = "";
  for (let i = answerIndex - 1; i >= 0; i--) {
    if (transcript[i].role === "assistant") {
      question = transcript[i].content;
      break;
    }
  }

  // Immediately-following probe exchanges usually carry the measurable result
  // the interviewer dug for — pull a couple in so the STAR "R" isn't lost.
  const followUps: { question: string; answer: string }[] = [];
  let pendingQuestion: string | null = null;
  for (
    let i = answerIndex + 1;
    i < transcript.length && followUps.length < MAX_FOLLOW_UPS;
    i++
  ) {
    const m = transcript[i];
    if (m.role === "assistant") {
      pendingQuestion = m.content;
    } else if (m.role === "user" && pendingQuestion) {
      followUps.push({ question: pendingQuestion, answer: m.content });
      pendingQuestion = null;
    }
  }

  const { data: competencies } = await supabase
    .from("competencies")
    .select("id, name")
    .eq("interview_type", "behavioral");

  const draft = await draftStoryFromAnswer({
    question,
    answer: target.content,
    followUps,
    competencies: competencies ?? [],
  });

  if (!draft) {
    return {
      error: "Couldn't draft a story just now. Try again, or write it yourself.",
    };
  }

  return { error: null, draft };
}
