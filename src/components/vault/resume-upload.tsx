"use client";

import { useActionState, useEffect } from "react";
import { FileUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  extractResumePdfAction,
  saveRoleResume,
} from "@/lib/vault/insight-actions";
import type { ActionState } from "@/lib/forms";
import { RESUME_PDF_HINT } from "@/lib/vault/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const extractInitial: { error: string | null; text?: string } = { error: null };
const saveInitial: ActionState = { error: null };

// Upload a resume PDF → extract text → review/edit → save onto the role. Only
// the extracted text is stored, never the binary. Saving updates the role's
// resume, which the "How you align" matcher reads.
export function ResumeUpload({
  roleId,
  companyId,
}: {
  roleId: string;
  companyId: string;
}) {
  const [extractState, extractAction, extracting] = useActionState(
    extractResumePdfAction,
    extractInitial
  );
  const [saveState, saveAction, saving] = useActionState(
    saveRoleResume,
    saveInitial
  );

  useEffect(() => {
    if (extractState.error) toast.error(extractState.error);
  }, [extractState]);

  useEffect(() => {
    if (saveState.success) toast.success("Resume saved");
    else if (saveState.error) toast.error(saveState.error);
  }, [saveState]);

  return (
    <div className="flex flex-col gap-4">
      <form action={extractAction} className="flex flex-col gap-2">
        <Label htmlFor="resume-pdf">Upload resume PDF</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="resume-pdf"
            name="file"
            type="file"
            accept="application/pdf"
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-1 file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Button type="submit" variant="outline" size="sm" disabled={extracting}>
            {extracting ? <Loader2 className="animate-spin" /> : <FileUp />}
            {extracting ? "Reading…" : "Extract text"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{RESUME_PDF_HINT}</p>
      </form>

      {extractState.text ? (
        <form action={saveAction} className="flex flex-col gap-2">
          <input type="hidden" name="role_id" value={roleId} />
          <input type="hidden" name="company_id" value={companyId} />
          <Label htmlFor="resume-extracted">Review the extracted text</Label>
          <Textarea
            key={extractState.text}
            id="resume-extracted"
            name="resume"
            defaultValue={extractState.text}
            className="min-h-40"
          />
          <Button type="submit" size="sm" className="w-fit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "Saving…" : "Save to role"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
