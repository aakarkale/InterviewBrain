"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { BookOpenText, ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

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
      <PageHeader
        title="Story bank"
        description="Write each STAR story once. Behavioral mocks draw from these, and the brain links them to the competencies you tag."
        actions={
          !adding ? (
            <Button onClick={() => setAdding(true)}>
              <Plus /> New story
            </Button>
          ) : null
        }
      />

      {adding ? (
        <div className="rounded-lg border bg-card p-5">
          <StoryForm
            competencies={competencies}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      {stories.length === 0 && !adding ? (
        <EmptyState
          icon={BookOpenText}
          title="No stories yet"
          description="Add your strongest STAR story — a launch, a turnaround, a hard tradeoff."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus /> New story
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
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
  const [expanded, setExpanded] = useState(false);
  const tags = storyTags(story);
  // Rough threshold for when clamped content actually hides something.
  const isLong = story.content.length > 420 || story.content.split("\n").length > 6;

  if (editing) {
    return (
      <li className="rounded-lg border bg-card p-5">
        <StoryForm
          story={story}
          competencies={competencies}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{story.title}</h2>
        <div className="flex items-center gap-0.5">
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
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                if (!confirm("Delete this story?")) e.preventDefault();
              }}
            >
              <Trash2 />
            </Button>
          </form>
        </div>
      </div>

      <p
        className={`text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground ${
          expanded ? "" : "line-clamp-4"
        }`}
      >
        {story.content}
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

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
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
          Competencies <span className="text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid gap-4 rounded-md border bg-surface-0/40 p-4 sm:grid-cols-3">
          {INTERVIEW_TYPES.map((type) => {
            const group = competencies.filter(
              (c) => c.interview_type === type.value
            );
            if (group.length === 0) return null;
            return (
              <div key={type.value} className="flex flex-col gap-2">
                <p className="text-micro text-muted-foreground">{type.label}</p>
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
                      className="size-3.5 rounded border-border accent-primary"
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

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Saving…" : "Save story"}
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
