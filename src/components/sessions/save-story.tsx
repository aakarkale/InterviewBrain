"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  createStory,
  draftStoryFromSession,
  type ActionState,
} from "@/lib/stories/actions";
import type { StoryDraft } from "@/lib/stories/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

// One candidate answer from the transcript, with the interviewer question it
// responded to and its index in the parsed transcript (the draft key).
export type SavableAnswer = {
  index: number;
  question: string;
  answer: string;
};

type Competency = { id: string; name: string };

export function SaveStory({
  sessionId,
  answers,
  competencies,
}: {
  sessionId: string;
  answers: SavableAnswer[];
  competencies: Competency[];
}) {
  // The answer currently being drafted (its transcript index) and the returned
  // draft, plus which answers have already been saved this visit.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [isDrafting, startDrafting] = useTransition();

  function handleDraft(index: number) {
    setPendingIndex(index);
    startDrafting(async () => {
      const result = await draftStoryFromSession(sessionId, index);
      setPendingIndex(null);
      if (result.error || !result.draft) {
        toast.error(result.error ?? "Couldn't draft a story.");
        return;
      }
      setOpenIndex(index);
      setDraft(result.draft);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <BookOpenText className="size-4 text-primary" aria-hidden />
          Save a strong answer
        </h2>
        <p className="text-sm text-muted-foreground">
          Turn an answer into a reusable STAR story. We shape it into
          Situation–Task–Action–Result and suggest competency tags — you edit
          before it lands in your{" "}
          <Link href="/stories" className="text-primary hover:underline">
            story bank
          </Link>
          .
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {answers.map((a) => {
          const isOpen = openIndex === a.index && draft !== null;
          const isSaved = saved.has(a.index);
          return (
            <li
              key={a.index}
              className="flex flex-col gap-3 rounded-lg border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  {a.question ? (
                    <span className="line-clamp-1 text-micro text-text-3">
                      {a.question}
                    </span>
                  ) : null}
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {a.answer}
                  </p>
                </div>
                {isSaved ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                    <Check className="size-3.5" /> Saved
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={isDrafting}
                    onClick={() => handleDraft(a.index)}
                  >
                    {isDrafting && pendingIndex === a.index ? (
                      <>
                        <Loader2 className="animate-spin" /> Drafting…
                      </>
                    ) : (
                      <>
                        <Sparkles /> {isOpen ? "Redraft" : "Draft story"}
                      </>
                    )}
                  </Button>
                )}
              </div>

              {isOpen && !isSaved ? (
                <DraftForm
                  key={a.index}
                  sessionId={sessionId}
                  draft={draft}
                  competencies={competencies}
                  onSaved={() => {
                    setSaved((prev) => new Set(prev).add(a.index));
                    setOpenIndex(null);
                    setDraft(null);
                  }}
                  onCancel={() => {
                    setOpenIndex(null);
                    setDraft(null);
                  }}
                />
              ) : null}

              {isSaved ? (
                <Link
                  href="/stories"
                  className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
                >
                  View in story bank <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DraftForm({
  sessionId,
  draft,
  competencies,
  onSaved,
  onCancel,
}: {
  sessionId: string;
  draft: StoryDraft;
  competencies: Competency[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const selected = new Set(draft.competency_tags);
  const [state, formAction, isPending] = useActionState(
    createStory,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Saved to your story bank");
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 border-t border-border/70 pt-4"
    >
      <input type="hidden" name="source_session_id" value={sessionId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-title`}>Title</Label>
        <Input
          id={`${uid}-title`}
          name="title"
          defaultValue={draft.title}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-content`}>Story</Label>
        <Textarea
          id={`${uid}-content`}
          name="content"
          defaultValue={draft.content}
          className="min-h-44"
          required
        />
        <p className="text-xs text-muted-foreground">
          Drafted from your answer — tighten it and fill any{" "}
          <span className="font-mono">[bracketed]</span> gaps before saving.
        </p>
      </div>

      {competencies.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            Competencies{" "}
            <span className="text-muted-foreground">(edit as needed)</span>
          </legend>
          <div className="grid gap-2 rounded-md border bg-surface-0/40 p-4 sm:grid-cols-2">
            {competencies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="competency_tags"
                  value={c.id}
                  defaultChecked={selected.has(c.id)}
                  className="size-3.5 rounded border-border accent-primary"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : "Save story"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
