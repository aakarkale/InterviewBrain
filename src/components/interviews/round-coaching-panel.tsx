"use client";

import { useActionState, useEffect } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateRoundCoachingAction } from "@/lib/interviews/insight-actions";
import type { ActionState } from "@/lib/forms";
import { asRoundCoaching, type Round } from "@/lib/vault/types";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-micro text-muted-foreground">{title}</span>
      <ul className="flex list-disc flex-col gap-1 pl-4">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoundCoachingPanel({ round }: { round: Round }) {
  const [state, action, pending] = useActionState(
    generateRoundCoachingAction,
    initialState
  );
  const coaching = asRoundCoaching(round.coaching);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Round-to-round coaching"
        description="From this round's notes, transcript, and summary — how to prep for the next one."
        actions={
          <form action={action}>
            <input type="hidden" name="round_id" value={round.id} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : coaching ? (
                <RefreshCw />
              ) : (
                <Sparkles />
              )}
              {pending ? "Thinking…" : coaching ? "Refresh" : "Coach me"}
            </Button>
          </form>
        }
      />

      {!coaching ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Add notes, a transcript, or a summary above, then generate coaching for
          your next round.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
          <p className="text-sm leading-relaxed">{coaching.summary}</p>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
            <List title="What went well" items={coaching.what_went_well} />
            <List title="Gaps" items={coaching.gaps} />
            <List title="Next-round focus" items={coaching.next_round_focus} />
          </div>
        </div>
      )}
    </section>
  );
}
