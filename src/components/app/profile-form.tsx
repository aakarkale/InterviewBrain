"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateProfile, type ProfileState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProfileState = { error: null, success: false };

export function ProfileForm({ fullName }: { fullName: string | null }) {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Profile updated");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          defaultValue={fullName ?? ""}
          required
        />
        <p className="text-xs text-muted-foreground">
          The interviewer uses this when addressing you.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
