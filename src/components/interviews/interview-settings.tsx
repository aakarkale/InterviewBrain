"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { deleteInterview, updateInterview } from "@/lib/interviews/actions";
import type { ActionState } from "@/lib/forms";
import type { Interview } from "@/lib/vault/types";
import { INTERVIEW_STATUSES } from "@/lib/vault/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const initialState: ActionState = { error: null };

export function InterviewSettings({
  interview,
  backHref,
}: {
  interview: Interview;
  backHref: string;
}) {
  const [state, action, pending] = useActionState(updateInterview, initialState);

  useEffect(() => {
    if (state.success) toast.success("Interview updated");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <details className="group rounded-lg border bg-surface-0/40">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        Manage interview
      </summary>
      <div className="flex flex-col gap-4 border-t px-4 py-4">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={interview.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" defaultValue={interview.label} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={interview.status}>
                {INTERVIEW_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" size="sm" className="w-fit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
        <form action={deleteInterview} className="border-t pt-4">
          <input type="hidden" name="id" value={interview.id} />
          <input type="hidden" name="back" value={backHref} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              if (!confirm("Delete this interview and its rounds?")) e.preventDefault();
            }}
          >
            Delete interview
          </Button>
        </form>
      </div>
    </details>
  );
}
