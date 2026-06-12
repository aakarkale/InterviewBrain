"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageSquareText, Play } from "lucide-react";
import { toast } from "sonner";

import { startSession, type ActionState } from "@/lib/sessions/actions";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import type { Round } from "@/lib/applications/queries";
import type { Session } from "@/lib/sessions/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
  applicationId,
  isArchived,
  rounds,
  sessions,
}: {
  applicationId: string;
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
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Practice sessions</h2>
        <p className="text-sm text-muted-foreground">
          Run a text mock built from this vault — your JD, resume, notes, and
          transcripts. Feedback is scored and fed to your brain.
        </p>
      </div>

      {isArchived ? (
        <div className="rounded-xl border border-dashed bg-card/40 px-5 py-6 text-sm text-muted-foreground">
          This application is archived. Unarchive it to start a new session.
        </div>
      ) : (
        <form
          action={action}
          className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
        >
          <input type="hidden" name="application_id" value={applicationId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interview_type">Interview type</Label>
              <select
                id="interview_type"
                name="interview_type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="round_id">Target round (optional)</Label>
              <select
                id="round_id"
                name="round_id"
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">No specific round</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    Round {r.round_number} · {r.round_type.replace("_", " ")}
                  </option>
                ))}
              </select>
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
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const avg = averageScore(s);
            const done = s.status === "completed";
            return (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    {done ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden />
                    ) : (
                      <MessageSquareText
                        className="size-4 text-primary"
                        aria-hidden
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {interviewLabel(s.interview_type)} mock
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                        {done ? " · completed" : " · in progress"}
                      </span>
                    </div>
                  </div>
                  {done && avg !== null ? (
                    <Badge variant={avg <= 2 ? "destructive" : "secondary"}>
                      {avg.toFixed(1)}/5
                    </Badge>
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
