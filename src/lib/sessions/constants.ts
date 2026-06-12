// Session-engine constants. Client-safe: no server-only imports.

// Free-tier guardrail (SPEC Monetization): doubles as the AI cost ceiling.
export const MAX_SESSIONS_PER_MONTH = 10;

// Cost guardrail (SPEC AI Usage): hard cap on transcript length per session.
// 40 messages ≈ 20 interviewer/candidate exchanges — beyond a real 40-minute
// mock. The interviewer is prompted to wrap up before the cap bites.
export const MAX_TRANSCRIPT_MESSAGES = 40;

// Candidate answers are pasted text at most; this bounds a single turn.
export const MAX_MESSAGE_LENGTH = 8000;

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

// Transcript rows come back from Postgres as untyped Json; keep only
// well-formed messages so a malformed row can never break a session.
export function parseTranscript(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      "role" in entry &&
      "content" in entry &&
      (entry.role === "user" || entry.role === "assistant") &&
      typeof entry.content === "string"
    ) {
      messages.push({ role: entry.role, content: entry.content });
    }
  }
  return messages;
}
