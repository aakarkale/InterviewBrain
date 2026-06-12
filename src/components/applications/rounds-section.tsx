"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  CalendarClock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createRound,
  deleteRound,
  updateRound,
  type ActionState,
} from "@/lib/applications/actions";
import type { Round } from "@/lib/applications/queries";
import { ROUND_OUTCOMES, ROUND_TYPES } from "@/lib/applications/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

const roundTypeLabel = (value: string) =>
  ROUND_TYPES.find((t) => t.value === value)?.label ?? value;
const outcomeLabel = (value: string) =>
  ROUND_OUTCOMES.find((t) => t.value === value)?.label ?? value;

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "destructive";
const outcomeVariant = (value: string): BadgeVariant => {
  if (value === "passed") return "success";
  if (value === "rejected") return "destructive";
  if (value === "completed") return "secondary";
  return "outline";
};

export function RoundsSection({
  applicationId,
  rounds,
}: {
  applicationId: string;
  rounds: Round[];
}) {
  const [adding, setAdding] = useState(false);
  const nextNumber =
    rounds.reduce((max, r) => Math.max(max, r.round_number), 0) + 1;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rounds</h2>
          <p className="text-sm text-muted-foreground">
            Track each interview and what actually happened — real rounds teach
            the brain too.
          </p>
        </div>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add round
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <RoundForm
            applicationId={applicationId}
            defaultNumber={nextNumber}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      {rounds.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
          No rounds yet. Add the recruiter screen or your next scheduled round.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rounds.map((round) => (
            <RoundRow key={round.id} round={round} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RoundRow({ round }: { round: Round }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-xl border bg-card p-5 shadow-sm">
        <RoundForm
          applicationId={round.application_id}
          round={round}
          defaultNumber={round.round_number}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  const sub = [round.interviewer_name, round.interviewer_role]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Round {round.round_number}</Badge>
          <span className="font-medium">
            {roundTypeLabel(round.round_type)}
          </span>
          <Badge variant={outcomeVariant(round.outcome)}>
            {outcomeLabel(round.outcome)}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <form action={deleteRound}>
            <input type="hidden" name="id" value={round.id} />
            <input
              type="hidden"
              name="application_id"
              value={round.application_id}
            />
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Delete round"
              onClick={(e) => {
                if (!confirm("Delete this round?")) e.preventDefault();
              }}
            >
              <Trash2 />
            </Button>
          </form>
        </div>
      </div>

      {sub || round.scheduled_date ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {sub ? <span>{sub}</span> : null}
          {round.scheduled_date ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {round.scheduled_date}
            </span>
          ) : null}
        </p>
      ) : null}

      {round.post_round_notes ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {round.post_round_notes}
        </p>
      ) : null}
    </li>
  );
}

function RoundForm({
  applicationId,
  round,
  defaultNumber,
  onDone,
}: {
  applicationId: string;
  round?: Round;
  defaultNumber: number;
  onDone: () => void;
}) {
  const isEdit = Boolean(round);
  const uid = useId();
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateRound : createRound,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Round updated" : "Round added");
      onDone();
    }
  }, [state, isEdit, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="application_id" value={applicationId} />
      {isEdit ? <input type="hidden" name="id" value={round!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-round_number`}>Round number</Label>
          <Input
            id={`${uid}-round_number`}
            name="round_number"
            type="number"
            min={1}
            defaultValue={round?.round_number ?? defaultNumber}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-round_type`}>Type</Label>
          <Select
            id={`${uid}-round_type`}
            name="round_type"
            defaultValue={round?.round_type ?? "recruiter"}
          >
            {ROUND_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-interviewer_name`}>
            Interviewer{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${uid}-interviewer_name`}
            name="interviewer_name"
            defaultValue={round?.interviewer_name ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-interviewer_role`}>
            Interviewer role{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${uid}-interviewer_role`}
            name="interviewer_role"
            defaultValue={round?.interviewer_role ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-scheduled_date`}>
            Date <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${uid}-scheduled_date`}
            name="scheduled_date"
            type="date"
            defaultValue={round?.scheduled_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-outcome`}>Outcome</Label>
          <Select
            id={`${uid}-outcome`}
            name="outcome"
            defaultValue={round?.outcome ?? "upcoming"}
          >
            {ROUND_OUTCOMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-post_round_notes`}>
          Post-round notes{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${uid}-post_round_notes`}
          name="post_round_notes"
          defaultValue={round?.post_round_notes ?? ""}
          placeholder="What was asked, what landed, what to fix…"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : isEdit ? "Save round" : "Add round"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
