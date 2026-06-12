"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { rescoreSession, type ActionState } from "@/lib/brain/actions";
import type { RubricScores } from "@/lib/ai/scorer";
import type { ChatMessage } from "@/lib/sessions/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Competency = { id: string; name: string };

const initialState: ActionState = { error: null };

const SCORE_LABEL: Record<number, string> = {
  1: "Serious concerns",
  2: "Below bar",
  3: "Meets bar",
  4: "Strong",
  5: "Exceptional",
};

export function SessionFeedback({
  sessionId,
  applicationId,
  companyName,
  roleTitle,
  interviewLabel,
  summary,
  rubricScores,
  competencies,
  transcript,
}: {
  sessionId: string;
  applicationId: string;
  companyName: string;
  roleTitle: string;
  interviewLabel: string;
  summary: string | null;
  rubricScores: RubricScores;
  competencies: Competency[];
  transcript: ChatMessage[];
}) {
  const [state, action, pending] = useActionState(rescoreSession, initialState);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const nameById = new Map(competencies.map((c) => [c.id, c.name]));
  const scored = Object.entries(rubricScores)
    .map(([id, v]) => ({ id, name: nameById.get(id) ?? id, ...v }))
    .sort((a, b) => a.score - b.score);

  const hasScores = scored.length > 0;
  const avg = hasScores
    ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/applications/${applicationId}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {companyName}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Session feedback
            </h1>
            <Badge variant="secondary">{interviewLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {companyName} · {roleTitle}
          </p>
        </div>
        {hasScores ? (
          <div className="flex flex-col items-end">
            <span className="text-2xl font-semibold tabular-nums">
              {avg.toFixed(1)}
              <span className="text-base text-muted-foreground">/5</span>
            </span>
            <span className="text-xs text-muted-foreground">average score</span>
          </div>
        ) : null}
      </div>

      {summary ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Summary
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}

      {hasScores ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Competency scores</h2>
          <p className="text-sm text-muted-foreground">
            Weakest first — these feed your brain across every application.
          </p>
          <div className="flex flex-col gap-3">
            {scored.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={s.score <= 2 ? "destructive" : "secondary"}>
                    {s.score}/5 · {SCORE_LABEL[s.score]}
                  </Badge>
                </div>
                <ScoreBar score={s.score} />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.comment}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed bg-card/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {summary
              ? "No competency scores for this session."
              : "Scoring didn't finish for this session."}
          </p>
          <form action={action} className="mt-3">
            <input type="hidden" name="id" value={sessionId} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Scoring…
                </>
              ) : (
                <>
                  <RefreshCw /> Score this session
                </>
              )}
            </Button>
          </form>
        </div>
      )}

      {hasScores ? (
        <form action={action}>
          <input type="hidden" name="id" value={sessionId} />
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Re-scoring…
              </>
            ) : (
              <>
                <RefreshCw /> Re-score
              </>
            )}
          </Button>
        </form>
      ) : null}

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={`size-4 transition-transform ${showTranscript ? "rotate-180" : ""}`}
          />
          {showTranscript ? "Hide" : "Show"} transcript ({transcript.length}{" "}
          messages)
        </button>
        {showTranscript ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-card/40 p-4">
            {transcript.map((m, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {m.role === "assistant" ? "Interviewer" : "You"}
                </span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded-full ${
            n <= score
              ? score <= 2
                ? "bg-destructive"
                : "bg-primary"
              : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}
