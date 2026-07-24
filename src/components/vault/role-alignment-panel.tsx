"use client";

import { useActionState, useEffect } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateRoleAlignmentAction } from "@/lib/vault/insight-actions";
import type { ActionState } from "@/lib/forms";
import {
  asRoleAlignment,
  type RequirementCoverage,
  type Role,
} from "@/lib/vault/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

const COVERAGE: Record<
  RequirementCoverage["coverage"],
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  strong: { label: "Strong", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  missing: { label: "Missing", variant: "destructive" },
};

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

function Requirements({ items }: { items: RequirementCoverage[] }) {
  if (items.length === 0) return null;
  const counts = { strong: 0, partial: 0, missing: 0 };
  for (const r of items) counts[r.coverage]++;

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro text-muted-foreground">Requirement coverage</span>
        <span className="text-micro text-text-3">
          {counts.strong} strong · {counts.partial} partial · {counts.missing} missing
        </span>
      </div>
      <ul className="flex flex-col divide-y">
        {items.map((r, i) => (
          <li key={i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <Badge variant={COVERAGE[r.coverage].variant} className="mt-0.5">
              {COVERAGE[r.coverage].label}
            </Badge>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm leading-snug">{r.requirement}</span>
              {r.evidence ? (
                <span className="text-xs leading-snug text-muted-foreground">
                  {r.evidence}
                </span>
              ) : null}
            </div>
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

  // New fields may be absent on alignments cached before the resume↔JD matcher.
  const requirements = alignment?.requirements ?? [];
  const keywordGaps = alignment?.keyword_gaps ?? [];
  const actions = alignment?.actions ?? [];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="How you align"
        description="A rigorous resume ↔ JD match — requirement-by-requirement coverage, keyword gaps, and what to do next."
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
            ? "Matching your resume against the JD, requirement by requirement…"
            : "Upload or paste your resume, then analyze how it matches this JD — per-requirement coverage, ATS keyword gaps, and concrete next steps."}
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
              <span className="text-micro text-muted-foreground">match</span>
            </div>
          </div>

          <Requirements items={requirements} />

          {keywordGaps.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t pt-4">
              <span className="text-micro text-muted-foreground">
                Keyword gaps <span className="text-text-3">— in the JD, not in your resume</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {keywordGaps.map((kw, i) => (
                  <Badge key={i} variant="outline">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
            <List title="Strengths" items={alignment.strengths} />
            <List title="Gaps" items={alignment.gaps} />
            <List title="Emphasize" items={alignment.talking_points} />
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t pt-4">
              <span className="text-micro text-muted-foreground">Recommended next steps</span>
              <ol className="flex flex-col gap-1.5">
                {actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span className="font-mono text-xs text-text-3 tabular-nums">
                      {i + 1}.
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <p className="text-micro text-text-3">
            AI-generated from your own material — never invents experience you don’t show.
          </p>
        </div>
      )}
    </section>
  );
}
