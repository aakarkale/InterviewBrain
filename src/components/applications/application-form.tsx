"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createApplication,
  updateApplication,
  type ActionState,
} from "@/lib/applications/actions";
import type { Application } from "@/lib/applications/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

export function ApplicationForm({
  application,
  onDone,
}: {
  application?: Application;
  onDone?: () => void;
}) {
  const isEdit = Boolean(application);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateApplication : createApplication,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Application updated" : "Application created");
      onDone?.();
    }
  }, [state, isEdit, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="id" value={application!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="company_name">Company</Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={application?.company_name ?? ""}
            placeholder="Linear"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role_title">Role</Label>
          <Input
            id="role_title"
            name="role_title"
            defaultValue={application?.role_title ?? ""}
            placeholder="Senior Product Manager"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hiring_manager">
            Hiring manager{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="hiring_manager"
            name="hiring_manager"
            defaultValue={application?.hiring_manager ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="team_name">
            Team <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="team_name"
            name="team_name"
            defaultValue={application?.team_name ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="job_description">Job description</Label>
        <Textarea
          id="job_description"
          name="job_description"
          defaultValue={application?.job_description ?? ""}
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
          defaultValue={application?.resume ?? ""}
          placeholder="Paste the resume you're using for this application…"
          className="min-h-32"
          required
        />
        <p className="text-xs text-muted-foreground">
          Paste-only in v1. The interviewer and the brain read this verbatim.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Create application"}
        </Button>
        {isEdit && onDone ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={isPending}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
