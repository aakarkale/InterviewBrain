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
        <ArrowLeft className="size-3.5" /> {companyName}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-[-0.01em]">
              Session feedback
            </h1>
            <Badge variant="secondary">{interviewLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {companyName} · {roleTitle}
          </p>
        </div>
        {hasScores ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-2xl leading-none font-medium tabular-nums">
              {avg.toFixed(1)}
              <span className="text-base text-text-3">/5</span>
            </span>
            <span className="text-micro text-muted-foreground">average</span>
          </div>
        ) : null}
      </div>

      {summary ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <h2 className="text-micro text-muted-foreground">Summary</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}

      {hasScores ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Competency scores</h2>
            <p className="text-sm text-muted-foreground">
              Weakest first — these feed your brain across every interview.
            </p>
          </div>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
            {scored.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      s.score <= 2 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {s.score}/5 · {SCORE_LABEL[s.score]}
                  </span>
                </div>
                <ScoreBar score={s.score} />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.comment}
                </p>
              </li>
            ))}
          </ul>
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
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-surface-0/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {summary
              ? "No competency scores for this session."
              : "Scoring didn't finish for this session."}
          </p>
          <form action={action}>
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

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          aria-expanded={showTranscript}
          className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={`size-3.5 transition-transform duration-150 ${showTranscript ? "rotate-180" : ""}`}
          />
          {showTranscript ? "Hide" : "Show"} transcript ({transcript.length}{" "}
          messages)
        </button>
        {showTranscript ? (
          <div className="flex flex-col gap-4 rounded-lg border bg-surface-0/40 p-4 sm:p-5">
            {transcript.map((m, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span
                  className={`text-micro ${
                    m.role === "assistant" ? "text-text-3" : "text-primary"
                  }`}
                >
                  {m.role === "assistant" ? "Interviewer" : "You"}
                </span>
                <p className="max-w-[72ch] text-sm leading-relaxed whitespace-pre-wrap">
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
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-1 flex-1 rounded-full ${
            n <= score
              ? score <= 2
                ? "bg-destructive"
                : score >= 4
                  ? "bg-success"
                  : "bg-primary"
              : "bg-surface-3"
          }`}
        />
      ))}
    </div>
  );
}
