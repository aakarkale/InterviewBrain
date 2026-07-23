"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteRound, updateRound } from "@/lib/interviews/actions";
import type { ActionState } from "@/lib/forms";
import type { Round } from "@/lib/vault/types";
import { ROUND_OUTCOMES, ROUND_TYPES } from "@/lib/vault/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

// Round detail form: metadata + the post-round notes/transcript/summary that
// feed round-to-round AI coaching.
export function RoundEditor({
  round,
  backHref,
}: {
  round: Round;
  backHref: string;
}) {
  const [state, action, pending] = useActionState(updateRound, initialState);

  useEffect(() => {
    if (state.success) toast.success("Round saved");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={round.id} />
      <input type="hidden" name="back" value={backHref} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="round_number">Round number</Label>
          <Input
            id="round_number"
            name="round_number"
            type="number"
            min={1}
            defaultValue={round.round_number}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="round_name">Name</Label>
          <Input
            id="round_name"
            name="round_name"
            defaultValue={round.round_name ?? ""}
            placeholder="Product sense loop"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="round_type">Type</Label>
          <Select id="round_type" name="round_type" defaultValue={round.round_type}>
            {ROUND_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="outcome">Outcome</Label>
          <Select id="outcome" name="outcome" defaultValue={round.outcome}>
            {ROUND_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="interviewer_name">
            Interviewer <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="interviewer_name"
            name="interviewer_name"
            defaultValue={round.interviewer_name ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="interviewer_role">
            Interviewer role{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="interviewer_role"
            name="interviewer_role"
            defaultValue={round.interviewer_role ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="scheduled_date">
            Date <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="scheduled_date"
            name="scheduled_date"
            type="date"
            defaultValue={round.scheduled_date ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="post_round_notes">Post-round notes</Label>
        <Textarea
          id="post_round_notes"
          name="post_round_notes"
          defaultValue={round.post_round_notes ?? ""}
          placeholder="What was asked, what landed, what to fix…"
          className="min-h-28"
        />
        <p className="text-xs text-muted-foreground">
          A logged outcome with notes teaches your brain from the real interview.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="transcript">
          Transcript <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="transcript"
          name="transcript"
          defaultValue={round.transcript ?? ""}
          placeholder="Paste the raw transcript if you have one…"
          className="min-h-28"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="summary">
          Your summary <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="summary"
          name="summary"
          defaultValue={round.summary ?? ""}
          placeholder="Your own recap of how it went…"
          className="min-h-24"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save round"}
        </Button>
        <Button
          type="submit"
          formAction={deleteRound}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            if (!confirm("Delete this round?")) e.preventDefault();
          }}
        >
          <Trash2 /> Delete round
        </Button>
      </div>
    </form>
  );
}
