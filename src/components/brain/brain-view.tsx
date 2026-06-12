"use client";

import { useTransition } from "react";
import {
  AlertTriangle,
  Brain,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { refreshBrain } from "@/lib/brain/actions";
import {
  insightEvidence,
  type Insight,
  type InsightType,
} from "@/lib/brain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_META: Record<
  InsightType,
  { label: string; variant: "destructive" | "success" | "warning"; icon: typeof Brain }
> = {
  weakness: { label: "Weakness", variant: "destructive", icon: AlertTriangle },
  strength: { label: "Strength", variant: "success", icon: TrendingUp },
  pattern: { label: "Pattern", variant: "warning", icon: Sparkles },
};

function evidenceSummary(insight: Insight): string {
  const counts = new Map<string, number>();
  for (const e of insightEvidence(insight)) {
    counts.set(e.source_type, (counts.get(e.source_type) ?? 0) + 1);
  }
  const label: Record<string, [string, string]> = {
    session: ["practice session", "practice sessions"],
    round: ["real round", "real rounds"],
    application: ["application", "applications"],
    story: ["story", "stories"],
    document: ["document", "documents"],
  };
  return (
    [...counts.entries()]
      .map(([type, n]) => `${n} ${label[type]?.[n === 1 ? 0 : 1] ?? type}`)
      .join(" · ") || "no evidence"
  );
}

export function BrainView({
  insights,
  competencyNames,
}: {
  insights: Insight[];
  competencyNames: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await refreshBrain();
      if (result.error) toast.error(result.error);
      else toast.success("Brain refreshed");
    });
  }

  // Ordered weakness → pattern → strength so the most actionable insights lead.
  const order: Record<string, number> = { weakness: 0, pattern: 1, strength: 2 };
  const sorted = [...insights].sort(
    (a, b) =>
      (order[a.type] ?? 9) - (order[b.type] ?? 9) ||
      b.confidence - a.confidence
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your brain</h1>
          <p className="text-sm text-muted-foreground">
            Patterns across every application — what you&apos;re strong at, what
            keeps tripping you up, and where it recurs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Refreshing…
            </>
          ) : (
            <>
              <RefreshCw /> Refresh
            </>
          )}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center">
          <Brain className="size-6 text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium">No insights yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Run a few practice sessions across your applications, or log notes
              from a real round. Once there&apos;s enough signal, the brain
              surfaces cross-company patterns here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((insight) => {
            const meta = TYPE_META[insight.type as InsightType] ?? TYPE_META.pattern;
            const Icon = meta.icon;
            const competency = insight.competency_id
              ? competencyNames[insight.competency_id]
              : null;
            return (
              <div
                key={insight.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={meta.variant} className="gap-1">
                    <Icon className="size-3" /> {meta.label}
                  </Badge>
                  {competency ? (
                    <Badge variant="outline">{competency}</Badge>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Math.round(insight.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{insight.summary}</p>
                <p className="text-xs text-muted-foreground">
                  Based on {evidenceSummary(insight)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The mind-map view of these connections arrives in the next phase.
      </p>
    </div>
  );
}
