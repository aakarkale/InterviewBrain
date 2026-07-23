"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageSquareText, Play } from "lucide-react";
import { toast } from "sonner";

import { startSession, type ActionState } from "@/lib/sessions/actions";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import type { Round } from "@/lib/vault/types";
import type { Session } from "@/lib/sessions/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

const interviewLabel = (value: string) =>
  INTERVIEW_TYPES.find((t) => t.value === value)?.label ?? value;

function averageScore(session: Session): number | null {
  const scores = session.rubric_scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return null;
  const values = Object.values(scores as Record<string, { score?: number }>)
    .map((v) => v?.score)
    .filter((s): s is number => typeof s === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function SessionsSection({
  interviewId,
  isArchived,
  rounds,
  sessions,
}: {
  interviewId: string;
  isArchived: boolean;
  rounds: Round[];
  sessions: Session[];
}) {
  const [state, action, pending] = useActionState(startSession, initialState);
  const [type, setType] = useState<string>(INTERVIEW_TYPES[0].value);
  const [roundId, setRoundId] = useState("");

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Practice sessions"
        description="Run a text mock built from this vault — your JD, resume, notes, and transcripts. Feedback is scored and fed to your brain."
      />

      {isArchived ? (
        <div className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-5 text-sm text-muted-foreground">
          This role is archived. Unarchive it to start a new session.
        </div>
      ) : (
        <form
          action={action}
          className="flex flex-col gap-4 rounded-lg border bg-card p-4"
        >
          <input type="hidden" name="interview_id" value={interviewId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interview_type">Interview type</Label>
              <Select
                id="interview_type"
                name="interview_type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="round_id">Target round (optional)</Label>
              <Select
                id="round_id"
                name="round_id"
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
              >
                <option value="">No specific round</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    Round {r.round_number} ·{" "}
                    {r.round_name ?? r.round_type.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Starting…
              </>
            ) : (
              <>
                <Play /> Start session
              </>
            )}
          </Button>
        </form>
      )}

      {sessions.length > 0 ? (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
          {sessions.map((s) => {
            const avg = averageScore(s);
            const done = s.status === "completed";
            return (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2/50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {done ? (
                      <CheckCircle2
                        className="size-3.5 shrink-0 text-success"
                        aria-hidden
                      />
                    ) : (
                      <MessageSquareText
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden
                      />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {interviewLabel(s.interview_type)} mock
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                        {done ? " · completed" : " · in progress"}
                      </span>
                    </div>
                  </div>
                  {done && avg !== null ? (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        avg <= 2 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {avg.toFixed(1)}/5
                    </span>
                  ) : done ? (
                    <Badge variant="secondary">Scored</Badge>
                  ) : (
                    <Badge variant="warning">Resume</Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
