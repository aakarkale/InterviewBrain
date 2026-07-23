"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createInterview } from "@/lib/interviews/actions";
import type { ActionState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null };

// Starts a new interview for a role. Rounds are snapshotted from the role's
// round plan on the server.
export function NewInterview({
  roleId,
  hasPlan,
}: {
  roleId: string;
  hasPlan: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createInterview, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New interview
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="role_id" value={roleId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" placeholder="First loop · Q3" defaultValue="Interview" />
      </div>
      <p className="text-xs text-muted-foreground">
        {hasPlan
          ? "Rounds from this role's plan will be added automatically — you can edit them afterward."
          : "No round plan set yet — you can add rounds after creating the interview."}
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Creating…" : "Create interview"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
