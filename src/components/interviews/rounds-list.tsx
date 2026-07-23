"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createRound } from "@/lib/interviews/actions";
import type { ActionState } from "@/lib/forms";
import type { Round } from "@/lib/vault/types";
import { ROUND_OUTCOMES, ROUND_TYPES } from "@/lib/vault/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

const outcomeLabel = (v: string) =>
  ROUND_OUTCOMES.find((o) => o.value === v)?.label ?? v;
const roundTypeLabel = (v: string) =>
  ROUND_TYPES.find((t) => t.value === v)?.label ?? v;

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "destructive";
const outcomeVariant = (v: string): BadgeVariant => {
  if (v === "passed") return "success";
  if (v === "rejected") return "destructive";
  if (v === "completed") return "secondary";
  return "outline";
};

export function RoundsList({
  interviewId,
  basePath,
  rounds,
}: {
  interviewId: string;
  basePath: string;
  rounds: Round[];
}) {
  const [adding, setAdding] = useState(false);
  const nextNumber =
    rounds.reduce((max, r) => Math.max(max, r.round_number), 0) + 1;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Rounds"
        description="Each round of this interview. Open one to log notes, a transcript, or a summary — the AI uses them to coach you into the next round."
        actions={
          !adding ? (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add round
            </Button>
          ) : undefined
        }
      />

      {adding ? (
        <div className="rounded-lg border bg-card p-4">
          <AddRoundForm
            interviewId={interviewId}
            defaultNumber={nextNumber}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      {rounds.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No rounds yet. Set a round plan on the role, or add one here.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
          {rounds.map((round) => {
            const sub = [round.interviewer_name, round.interviewer_role]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={round.id}>
                <Link
                  href={`${basePath}/rounds/${round.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/50"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-text-3">
                        R{round.round_number}
                      </span>
                      <span className="text-sm font-medium">
                        {round.round_name ?? roundTypeLabel(round.round_type)}
                      </span>
                      <Badge variant={outcomeVariant(round.outcome)}>
                        {outcomeLabel(round.outcome)}
                      </Badge>
                    </div>
                    {sub || round.scheduled_date ? (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {sub ? <span>{sub}</span> : null}
                        {round.scheduled_date ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3" />
                            {round.scheduled_date}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AddRoundForm({
  interviewId,
  defaultNumber,
  onDone,
}: {
  interviewId: string;
  defaultNumber: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createRound, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success("Round added");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="interview_id" value={interviewId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="round_number">Number</Label>
          <Input
            id="round_number"
            name="round_number"
            type="number"
            min={1}
            defaultValue={defaultNumber}
            required
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="round_name">Name</Label>
          <Input id="round_name" name="round_name" placeholder="Product sense loop" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="round_type">Type</Label>
          <Select id="round_type" name="round_type" defaultValue="behavioral">
            {ROUND_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="outcome">Outcome</Label>
          <Select id="outcome" name="outcome" defaultValue="upcoming">
            {ROUND_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Adding…" : "Add round"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
