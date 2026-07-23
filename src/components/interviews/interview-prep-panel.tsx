"use client";

import { useActionState, useEffect } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateInterviewPrepAction } from "@/lib/interviews/insight-actions";
import type { ActionState } from "@/lib/forms";
import { asInterviewPrep, type Interview } from "@/lib/vault/types";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

export function InterviewPrepPanel({ interview }: { interview: Interview }) {
  const [state, action, pending] = useActionState(
    generateInterviewPrepAction,
    initialState
  );
  const prep = asInterviewPrep(interview.prep);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Prep guidance"
        description="Synthesized from this role's JD, resume, docs, and rounds."
        actions={
          <form action={action}>
            <input type="hidden" name="interview_id" value={interview.id} />
            <input type="hidden" name="force" value={prep ? "true" : "false"} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : prep ? (
                <RefreshCw />
              ) : (
                <Sparkles />
              )}
              {pending ? "Preparing…" : prep ? "Refresh" : "Generate prep"}
            </Button>
          </form>
        }
      />

      {!prep ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {pending
            ? "Reading the vault and building your prep…"
            : "Generate focus areas, likely questions, and tips for this interview."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
          {prep.focus_areas.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-micro text-muted-foreground">Focus areas</span>
              <ul className="flex flex-col gap-2">
                {prep.focus_areas.map((f, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{f.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {f.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {prep.likely_questions.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <span className="text-micro text-muted-foreground">Likely questions</span>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {prep.likely_questions.map((q, i) => (
                  <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {prep.tips.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <span className="text-micro text-muted-foreground">Tips</span>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {prep.tips.map((t, i) => (
                  <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
