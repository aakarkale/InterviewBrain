"use client";

import { useMemo, useState, useTransition } from "react";
import { Brain, Loader2, Network, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { refreshBrain } from "@/lib/brain/actions";
import type { GraphData, Insight } from "@/lib/brain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { InsightCard } from "./insight-card";
import { MindMap } from "./mind-map";

type Tab = "insights" | "map";

export function BrainView({
  insights,
  graph,
  competencyNames,
  companiesByInsight,
}: {
  insights: Insight[];
  graph: GraphData;
  competencyNames: Record<string, string>;
  companiesByInsight: Record<string, string[]>;
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
  const sorted = useMemo(() => {
    const order: Record<string, number> = { weakness: 0, pattern: 1, strength: 2 };
    return [...insights].sort(
      (a, b) =>
        (order[a.type] ?? 9) - (order[b.type] ?? 9) || b.confidence - a.confidence
    );
  }, [insights]);

  // The first (highest-priority) insight that spans ≥2 companies gets the
  // one-time reveal.
  const revealId = useMemo(
    () =>
      sorted.find((i) => (companiesByInsight[i.id]?.length ?? 0) >= 2)?.id ?? null,
    [sorted, companiesByInsight]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your brain"
        description="Patterns across every interview — what you're strong at, what keeps tripping you up, and where it recurs."
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
          description="Run a few practice sessions across your interviews, or log notes from a real round. Once there's enough signal, the brain surfaces cross-company patterns here."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sorted.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              competencyName={
                insight.competency_id
                  ? (competencyNames[insight.competency_id] ?? null)
                  : null
              }
              companies={companiesByInsight[insight.id] ?? []}
              reveal={insight.id === revealId}
            />
          ))}
        </ul>
      )}
    </div>
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
