"use client";

import { useActionState, useEffect } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateRoleAlignmentAction } from "@/lib/vault/insight-actions";
import type { ActionState } from "@/lib/forms";
import { asRoleAlignment, type Role } from "@/lib/vault/types";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-micro text-muted-foreground">{title}</span>
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoleAlignmentPanel({ role }: { role: Role }) {
  const [state, action, pending] = useActionState(
    generateRoleAlignmentAction,
    initialState
  );
  const alignment = asRoleAlignment(role.alignment);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const scoreColor =
    alignment && alignment.fit_score >= 70
      ? "text-success"
      : alignment && alignment.fit_score <= 40
        ? "text-destructive"
        : "text-foreground";

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="How you align"
        description="An honest read on your fit for this role, from your resume, LinkedIn, and research."
        actions={
          <form action={action}>
            <input type="hidden" name="role_id" value={role.id} />
            <input type="hidden" name="force" value={alignment ? "true" : "false"} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : alignment ? (
                <RefreshCw />
              ) : (
                <Sparkles />
              )}
              {pending ? "Analyzing…" : alignment ? "Refresh" : "Analyze fit"}
            </Button>
          </form>
        }
      />

      {!alignment ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {pending
            ? "Reading your background against the JD…"
            : "Analyze how your background maps to this role — strengths, gaps, and what to emphasize."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm leading-relaxed">{alignment.summary}</p>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className={`font-mono text-2xl leading-none font-medium tabular-nums ${scoreColor}`}>
                {alignment.fit_score}
                <span className="text-base text-text-3">/100</span>
              </span>
              <span className="text-micro text-muted-foreground">fit</span>
            </div>
          </div>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
            <List title="Strengths" items={alignment.strengths} />
            <List title="Gaps" items={alignment.gaps} />
            <List title="Emphasize" items={alignment.talking_points} />
          </div>
          <p className="text-micro text-text-3">AI-generated from your own material.</p>
        </div>
      )}
    </section>
  );
}
