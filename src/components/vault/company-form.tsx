"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createCompany,
  updateCompany,
} from "@/lib/vault/actions";
import type { ActionState } from "@/lib/forms";
import type { Company } from "@/lib/vault/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null };

export function CompanyForm({
  company,
  onDone,
}: {
  company?: Company;
  onDone?: () => void;
}) {
  const isEdit = Boolean(company);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateCompany : createCompany,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Vault updated" : "Vault created");
      onDone?.();
    }
  }, [state, isEdit, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="id" value={company!.id} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Company</Label>
        <Input
          id="name"
          name="name"
          defaultValue={company?.name ?? ""}
          placeholder="Stripe"
          required
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-surface-0/40 p-4">
        <input
          type="checkbox"
          name="h1b_tracking_enabled"
          defaultChecked={company?.h1b_tracking_enabled ?? false}
          className="mt-0.5 size-4 rounded border-border accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Track H-1B sponsorship</span>
          <span className="text-xs text-muted-foreground">
            Adds a web-researched sponsorship section to this company&rsquo;s
            insights. Always shown with sources — verify independently.
          </span>
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create vault"}
        </Button>
        {isEdit && onDone ? (
          <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
