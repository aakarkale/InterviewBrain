"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Brain,
  Loader2,
  Network,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { refreshBrain } from "@/lib/brain/actions";
import {
  insightEvidence,
  type GraphData,
  type Insight,
  type InsightType,
} from "@/lib/brain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { MindMap } from "./mind-map";

type Tab = "insights" | "map";

const TYPE_META: Record<
  InsightType,
  {
    label: string;
    variant: "destructive" | "success" | "warning";
    rail: string;
    icon: typeof Brain;
  }
> = {
  weakness: {
    label: "Weakness",
    variant: "destructive",
    rail: "before:bg-destructive",
    icon: AlertTriangle,
  },
  strength: {
    label: "Strength",
    variant: "success",
    rail: "before:bg-success",
    icon: TrendingUp,
  },
  pattern: {
    label: "Pattern",
    variant: "warning",
    rail: "before:bg-warning",
    icon: Sparkles,
  },
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
  graph,
  competencyNames,
}: {
  insights: Insight[];
  graph: GraphData;
  competencyNames: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("insights");

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
      <PageHeader
        title="Your brain"
        description="Patterns across every application — what you're strong at, what keeps tripping you up, and where it recurs."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={pending}>
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
        }
      />

      <div
        role="tablist"
        aria-label="Brain view"
        className="inline-flex h-8 w-fit items-center gap-0.5 rounded-md border bg-surface-0/60 p-0.5"
      >
        <TabButton
          active={tab === "insights"}
          onClick={() => setTab("insights")}
          icon={<Sparkles className="size-3.5" />}
          label="Insights"
        />
        <TabButton
          active={tab === "map"}
          onClick={() => setTab("map")}
          icon={<Network className="size-3.5" />}
          label="Map"
        />
      </div>

      {tab === "map" ? (
        <MindMap data={graph} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No insights yet"
          description="Run a few practice sessions across your applications, or log notes from a real round. Once there's enough signal, the brain surfaces cross-company patterns here."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sorted.map((insight) => {
            const meta = TYPE_META[insight.type as InsightType] ?? TYPE_META.pattern;
            const Icon = meta.icon;
            const competency = insight.competency_id
              ? competencyNames[insight.competency_id]
              : null;
            return (
              <li
                key={insight.id}
                className={`relative flex flex-col gap-2.5 overflow-hidden rounded-lg border bg-card p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${meta.rail}`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={meta.variant}>
                    <Icon /> {meta.label}
                  </Badge>
                  {competency ? (
                    <Badge variant="outline">{competency}</Badge>
                  ) : null}
                  <span
                    className="ml-auto flex items-center gap-1.5"
                    title={`${Math.round(insight.confidence * 100)}% confidence`}
                  >
                    <ConfidenceMeter value={insight.confidence} />
                    <span className="font-mono text-xs tabular-nums text-text-3">
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{insight.summary}</p>
                <p className="font-mono text-xs text-text-3">
                  {evidenceSummary(insight)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <span className="flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-2.5 w-1 rounded-[1px] ${
            n <= filled ? "bg-primary/70" : "bg-surface-3"
          }`}
        />
      ))}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-full items-center gap-1.5 rounded-[5px] px-2.5 text-sm font-medium transition-colors duration-150 ${
        active
          ? "bg-surface-2 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
