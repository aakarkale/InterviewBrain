"use client";

import { Fragment, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Brain,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import gsap from "gsap";

import { insightEvidence, type Insight, type InsightType } from "@/lib/brain/types";
import { Badge } from "@/components/ui/badge";

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
    application: ["interview", "interviews"],
    story: ["story", "stories"],
    document: ["document", "documents"],
  };
  return (
    [...counts.entries()]
      .map(([type, n]) => `${n} ${label[type]?.[n === 1 ? 0 : 1] ?? type}`)
      .join(" · ") || "no evidence"
  );
}

const SEEN_KEY = "ib:xapp-seen";

function alreadySeen(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    if (!seen.includes(id)) {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
    }
  } catch {
    // storage unavailable — the reveal just plays again next visit
  }
}

export function InsightCard({
  insight,
  competencyName,
  companies,
  // Eligible to play the one-time reveal (the top cross-application insight).
  reveal,
}: {
  insight: Insight;
  competencyName: string | null;
  companies: string[];
  reveal: boolean;
}) {
  const meta = TYPE_META[insight.type as InsightType] ?? TYPE_META.pattern;
  const Icon = meta.icon;
  const isCrossApp = companies.length >= 2;

  const ref = useRef<HTMLLIElement>(null);

  // The second reserved in-app GSAP moment: the first time a weakness/pattern
  // is shown to span multiple companies, the card announces itself — a glow
  // pulse, the company chips and the links between them drawing in. Plays once
  // (localStorage), and never under prefers-reduced-motion.
  useEffect(() => {
    const el = ref.current;
    if (!el || !reveal || !isCrossApp) return;
    if (alreadySeen(insight.id)) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      markSeen(insight.id);
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: () => markSeen(insight.id),
      });
      tl.from(el, { opacity: 0, y: 12, scale: 0.985, duration: 0.5 })
        .fromTo(
          "[data-xapp-glow]",
          { opacity: 0, scale: 0.98 },
          { opacity: 1, scale: 1.015, duration: 0.5, yoyo: true, repeat: 1 },
          0.1
        )
        .from(
          "[data-xapp-link]",
          { scaleX: 0, transformOrigin: "left center", duration: 0.45, stagger: 0.12 },
          "-=0.35"
        )
        .from(
          "[data-xapp-chip]",
          { opacity: 0, y: 8, duration: 0.4, stagger: 0.12 },
          "<"
        );
    }, el);
    return () => ctx.revert();
  }, [reveal, isCrossApp, insight.id]);

  return (
    <li
      ref={ref}
      className={`relative flex flex-col gap-2.5 overflow-hidden rounded-lg border bg-card p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${meta.rail} ${
        isCrossApp ? "border-primary/30" : ""
      }`}
    >
      {isCrossApp ? (
        <span
          data-xapp-glow
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-primary/40 ring-inset"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={meta.variant}>
          <Icon /> {meta.label}
        </Badge>
        {competencyName ? (
          <Badge variant="outline">{competencyName}</Badge>
        ) : null}
        {isCrossApp ? (
          <Badge variant="default">
            <Layers /> {companies.length} interviews
          </Badge>
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

      {isCrossApp ? (
        <div className="flex items-center gap-2 pt-0.5">
          {companies.map((c, i) => (
            <Fragment key={c}>
              {i > 0 ? (
                <span
                  data-xapp-link
                  aria-hidden
                  className="h-px max-w-12 flex-1 bg-primary/40"
                />
              ) : null}
              <span
                data-xapp-chip
                className="inline-flex items-center rounded-[5px] border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
              >
                {c}
              </span>
            </Fragment>
          ))}
          <span className="ml-1 text-xs text-text-3">same gap, more than once</span>
        </div>
      ) : null}

      <p className="font-mono text-xs text-text-3">{evidenceSummary(insight)}</p>
    </li>
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
