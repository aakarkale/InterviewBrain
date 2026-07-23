import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { anthropic, MODEL } from "@/lib/ai/client";
import { buildInterviewerPrompt, KICKOFF_MESSAGE } from "@/lib/ai/interviewer";
import {
  MAX_MESSAGE_LENGTH,
  MAX_TRANSCRIPT_MESSAGES,
  parseTranscript,
  type ChatMessage,
} from "@/lib/sessions/constants";

// Streaming an interviewer turn comfortably outlives serverless defaults.
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// POST { message?: string } — empty body opens the interview (first turn);
// afterwards each call carries one candidate answer. Streams the
// interviewer's reply as plain text and persists the full transcript once
// the turn completes, so a dropped stream leaves the transcript unchanged
// and the client can simply retry.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Not signed in.", 401);

  // RLS returns only the owner's session.
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!session) return jsonError("Session not found.", 404);
  if (session.status !== "in_progress") {
    return jsonError("This session is already complete.", 409);
  }

  let message = "";
  try {
    const body = await request.json().catch(() => ({}));
    message = String(body?.message ?? "").trim();
  } catch {
    message = "";
  }

  const transcript = parseTranscript(session.transcript);
  const isOpening = transcript.length === 0;

  if (!isOpening && !message) return jsonError("Say something first.", 400);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonError("That answer is too long for one turn.", 400);
  }
  if (transcript.length >= MAX_TRANSCRIPT_MESSAGES) {
    return jsonError(
      "This session hit its length limit. End the interview to get your feedback.",
      409
    );
  }

  if (!session.interview_id) return jsonError("Interview not found.", 404);

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, role_id")
    .eq("id", session.interview_id)
    .maybeSingle();
  if (!interview) return jsonError("Interview not found.", 404);

  const { data: role } = await supabase
    .from("roles")
    .select("*")
    .eq("id", interview.role_id)
    .maybeSingle();
  if (!role) return jsonError("Role not found.", 404);

  const [{ data: company }, { data: documents }, { data: round }, { data: rounds }, { data: stories }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", role.company_id).maybeSingle(),
      supabase
        .from("documents")
        .select("*")
        .eq("role_id", role.id)
        .order("created_at", { ascending: true }),
      session.round_id
        ? supabase
            .from("rounds")
            .select("*")
            .eq("id", session.round_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("rounds")
        .select("id")
        .eq("interview_id", session.interview_id),
      session.interview_type === "behavioral"
        ? supabase
            .from("stories")
            .select("*")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  if (!company) return jsonError("Company not found.", 404);

  const system = buildInterviewerPrompt({
    interviewType: session.interview_type,
    company,
    role,
    documents: documents ?? [],
    round: round ?? null,
    roundCount: rounds?.length ?? 0,
    stories: stories ?? [],
  });

  const nextTranscript: ChatMessage[] = isOpening
    ? []
    : [...transcript, { role: "user", content: message }];

  // The constant kickoff turn satisfies the leading-user-message requirement
  // and keeps the prompt prefix stable across turns for caching.
  const apiMessages = [
    { role: "user" as const, content: KICKOFF_MESSAGE },
    ...nextTranscript.map((m) => ({ role: m.role, content: m.content })),
  ];

  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    // Recommended Sonnet 4.6 config for conversational turns: no thinking,
    // low effort. Keeps the chat fast and cheap; scoring runs deeper.
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system,
    messages: apiMessages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await stream.finalMessage();
        const reply = final.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();

        if (reply) {
          const { error } = await supabase
            .from("sessions")
            .update({
              transcript: [
                ...nextTranscript,
                { role: "assistant", content: reply },
              ],
            })
            .eq("id", session.id);
          if (error) throw error;
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
