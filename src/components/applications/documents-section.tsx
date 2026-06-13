"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createDocument,
  deleteDocument,
  updateDocument,
  type ActionState,
} from "@/lib/applications/actions";
import type { DocumentRow } from "@/lib/applications/queries";
import { DOCUMENT_TYPES } from "@/lib/applications/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

const typeLabel = (value: string) =>
  DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;

type BadgeVariant = "default" | "secondary" | "outline";
const typeVariant = (value: string): BadgeVariant => {
  if (value === "call_transcript") return "default";
  if (value === "call_summary") return "secondary";
  return "outline";
};

export function DocumentsSection({
  applicationId,
  documents,
}: {
  applicationId: string;
  documents: DocumentRow[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Notes, call summaries, and pasted transcripts. All of it feeds the
            interviewer — transcripts get the heaviest weighting.
          </p>
        </div>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add document
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-lg border bg-card p-4">
          <DocumentForm
            applicationId={applicationId}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      {documents.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No documents yet. Paste a recruiter-call transcript or drop in your
          research notes.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
          {documents.map((document) => (
            <DocumentRowItem key={document.id} document={document} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRowItem({ document }: { document: DocumentRow }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isLong =
    document.content.length > 320 || document.content.split("\n").length > 4;

  if (editing) {
    return (
      <li className="bg-surface-0/40 p-4">
        <DocumentForm
          applicationId={document.application_id}
          document={document}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={typeVariant(document.type)}>
            {typeLabel(document.type)}
          </Badge>
          <span className="truncate text-sm font-medium">{document.title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <form action={deleteDocument}>
            <input type="hidden" name="id" value={document.id} />
            <input
              type="hidden"
              name="application_id"
              value={document.application_id}
            />
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Delete document"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                if (!confirm("Delete this document?")) e.preventDefault();
              }}
            >
              <Trash2 />
            </Button>
          </form>
        </div>
      </div>
      <p
        className={`text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {document.content}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-text-3 transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={`size-3 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </li>
  );
}

function DocumentForm({
  applicationId,
  document,
  onDone,
}: {
  applicationId: string;
  document?: DocumentRow;
  onDone: () => void;
}) {
  const isEdit = Boolean(document);
  const uid = useId();
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateDocument : createDocument,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Document updated" : "Document added");
      onDone();
    }
  }, [state, isEdit, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="application_id" value={applicationId} />
      {isEdit ? <input type="hidden" name="id" value={document!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-title`}>Title</Label>
          <Input
            id={`${uid}-title`}
            name="title"
            defaultValue={document?.title ?? ""}
            placeholder="Recruiter screen — Apr 12"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-type`}>Type</Label>
          <Select
            id={`${uid}-type`}
            name="type"
            defaultValue={document?.type ?? "note"}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-content`}>Content</Label>
        <Textarea
          id={`${uid}-content`}
          name="content"
          defaultValue={document?.content ?? ""}
          placeholder="Paste the transcript, summary, or notes…"
          className="min-h-32"
          required
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
          {isPending ? "Saving…" : isEdit ? "Save document" : "Add document"}
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
