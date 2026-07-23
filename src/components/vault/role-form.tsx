"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createRole, updateRole } from "@/lib/vault/actions";
import type { ActionState } from "@/lib/forms";
import type { Role } from "@/lib/vault/types";
import { LINKEDIN_PDF_HINT } from "@/lib/vault/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

export function RoleForm({
  companyId,
  role,
  onDone,
}: {
  companyId: string;
  role?: Role;
  onDone?: () => void;
}) {
  const isEdit = Boolean(role);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateRole : createRole,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Role updated" : "Role created");
      onDone?.();
    }
  }, [state, isEdit, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="company_id" value={companyId} />
      {isEdit ? <input type="hidden" name="id" value={role!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Role</Label>
          <Input
            id="title"
            name="title"
            defaultValue={role?.title ?? ""}
            placeholder="Senior Product Manager, Payments"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hiring_manager">
            Hiring manager <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="hiring_manager"
            name="hiring_manager"
            defaultValue={role?.hiring_manager ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="team_name">
            Team <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="team_name" name="team_name" defaultValue={role?.team_name ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="job_description">Job description</Label>
        <Textarea
          id="job_description"
          name="job_description"
          defaultValue={role?.job_description ?? ""}
          placeholder="Paste the JD…"
          className="min-h-32"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="resume">Resume</Label>
        <Textarea
          id="resume"
          name="resume"
          defaultValue={role?.resume ?? ""}
          placeholder="Paste the resume you're using for this role…"
          className="min-h-32"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="linkedin_profile">
          LinkedIn profile <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="linkedin_profile"
          name="linkedin_profile"
          defaultValue={role?.linkedin_profile ?? ""}
          placeholder="Paste your LinkedIn profile text…"
          className="min-h-24"
        />
        <p className="text-xs text-muted-foreground">{LINKEDIN_PDF_HINT}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="research_notes">
          Research notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="research_notes"
          name="research_notes"
          defaultValue={role?.research_notes ?? ""}
          placeholder="Anything you've learned about this role, team, or process…"
          className="min-h-24"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create role"}
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
