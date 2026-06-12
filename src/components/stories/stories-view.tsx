"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { BookOpenText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createStory,
  deleteStory,
  updateStory,
  type ActionState,
} from "@/lib/stories/actions";
import { storyTags, type Competency, type Story } from "@/lib/stories/types";
import { INTERVIEW_TYPES } from "@/lib/applications/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

export function StoriesView({
  stories,
  competencies,
}: {
  stories: Story[];
  competencies: Competency[];
}) {
  const [adding, setAdding] = useState(false);
  const nameById = useMemo(
    () => new Map(competencies.map((c) => [c.id, c.name])),
    [competencies]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Story bank</h1>
          <p className="text-sm text-muted-foreground">
            Write each STAR story once. Behavioral mocks draw from these, and the
            brain links them to the competencies you tag.
          </p>
        </div>
        {!adding ? (
          <Button onClick={() => setAdding(true)}>
            <Plus /> New story
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <StoryForm
            competencies={competencies}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      {stories.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
          <BookOpenText className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            No stories yet. Add your strongest STAR story — a launch, a turnaround,
            a hard tradeoff.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {stories.map((story) => (
            <StoryRow
              key={story.id}
              story={story}
              competencies={competencies}
              nameById={nameById}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function StoryRow({
  story,
  competencies,
  nameById,
}: {
  story: Story;
  competencies: Competency[];
  nameById: Map<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const tags = storyTags(story);

  if (editing) {
    return (
      <li className="rounded-xl border bg-card p-6 shadow-sm">
        <StoryForm
          story={story}
          competencies={competencies}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-medium">{story.title}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <form action={deleteStory}>
            <input type="hidden" name="id" value={story.id} />
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Delete story"
              onClick={(e) => {
                if (!confirm("Delete this story?")) e.preventDefault();
              }}
            >
              <Trash2 />
            </Button>
          </form>
        </div>
      </div>

      <p className="max-h-56 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {story.content}
      </p>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((id) => (
            <Badge key={id} variant="secondary">
              {nameById.get(id) ?? id}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function StoryForm({
  story,
  competencies,
  onDone,
}: {
  story?: Story;
  competencies: Competency[];
  onDone: () => void;
}) {
  const isEdit = Boolean(story);
  const uid = useId();
  const selected = new Set(story ? storyTags(story) : []);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateStory : createStory,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Story updated" : "Story saved");
      onDone();
    }
  }, [state, isEdit, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="id" value={story!.id} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-title`}>Title</Label>
        <Input
          id={`${uid}-title`}
          name="title"
          defaultValue={story?.title ?? ""}
          placeholder="Turned around the churning enterprise account"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-content`}>Story</Label>
        <Textarea
          id={`${uid}-content`}
          name="content"
          defaultValue={story?.content ?? ""}
          placeholder="Situation… Task… Action… Result…"
          className="min-h-40"
          required
        />
        <p className="text-xs text-muted-foreground">
          STAR structure works best — the interviewer reuses these verbatim.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          Competencies{" "}
          <span className="text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {INTERVIEW_TYPES.map((type) => {
            const group = competencies.filter(
              (c) => c.interview_type === type.value
            );
            if (group.length === 0) return null;
            return (
              <div key={type.value} className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {type.label}
                </p>
                {group.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="competency_tags"
                      value={c.id}
                      defaultChecked={selected.has(c.id)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : isEdit ? "Save story" : "Save story"}
        </Button>
        <Button
          type="button"
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
