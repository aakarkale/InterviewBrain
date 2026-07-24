"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  asRoleAlignment,
  type RequirementCoverage,
  type Role,
} from "@/lib/vault/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/page-header";
import { ResumeUpload } from "@/components/vault/resume-upload";

// Fallback estimate/timeout; the POST response overrides the estimate.
const ESTIMATE_SECONDS = 45;
const MAX_WAIT_SECONDS = 180;

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
  const router = useRouter();
  const alignment = asRoleAlignment(role.alignment);

  // "starting" = POST in flight; "pending" = running in the background, polling.
  const [phase, setPhase] = useState<"idle" | "starting" | "pending">("idle");
  const [estimate, setEstimate] = useState(ESTIMATE_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const baselineRef = useRef<string | null>(null);

  const busy = phase !== "idle";

  const onAnalyze = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("starting");
    try {
      const res = await fetch(`/api/roles/${role.id}/alignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: Boolean(alignment) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't start the analysis.");

      if (data.status === "fresh") {
        router.refresh();
        setPhase("idle");
        return;
      }

      baselineRef.current = data.baseline_generated_at ?? null;
      setEstimate(
        typeof data.estimate_seconds === "number" ? data.estimate_seconds : ESTIMATE_SECONDS
      );
      setElapsed(0);
      setPhase("pending");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the analysis.");
      setPhase("idle");
    }
  }, [phase, role.id, alignment, router]);

  // While pending, tick a countdown every second and poll for completion every
  // few seconds. Detection is by the alignment timestamp advancing past the
  // baseline captured at start — the generation runs server-side regardless of
  // this tab, so navigating away and back still lands on the fresh result.
  useEffect(() => {
    if (phase !== "pending") return;
    let stop = false;
    let secs = 0;

    // Setting phase to "idle" re-runs this effect, whose cleanup clears the
    // interval — so we never need the interval id inside the tick itself.
    const id = setInterval(async () => {
      if (stop) return;
      secs += 1;
      setElapsed(secs);

      if (secs % 3 === 0) {
        try {
          const res = await fetch(`/api/roles/${role.id}/alignment`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            const gen: string | null = data?.generated_at ?? null;
            if (gen && gen !== baselineRef.current) {
              stop = true;
              setElapsed(0);
              setPhase("idle");
              router.refresh();
              return;
            }
          }
        } catch {
          // transient — keep polling
        }
      }

      if (secs >= MAX_WAIT_SECONDS) {
        stop = true;
        setElapsed(0);
        setPhase("idle");
        toast.error(
          "This is taking longer than usual — refresh the page in a moment to see your analysis."
        );
      }
    }, 1000);

    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [phase, role.id, router]);

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

  const remaining = Math.max(0, estimate - elapsed);
  const etaLabel =
    phase === "starting"
      ? "starting…"
      : remaining > 0
        ? `~${remaining}s`
        : "wrapping up…";

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="How you align"
        description="A rigorous resume ↔ JD match — requirement-by-requirement coverage, keyword gaps, and what to do next."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowUpload((v) => !v)}
            >
              <Upload />
              Upload resume
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAnalyze}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : alignment ? (
                <RefreshCw />
              ) : (
                <Sparkles />
              )}
              {busy ? "Analyzing…" : alignment ? "Refresh" : "Analyze fit"}
            </Button>
            {busy ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                ({etaLabel})
              </span>
            ) : null}
          </div>
        }
      />

      {showUpload ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-surface-0/40 p-4">
          <p className="text-sm text-muted-foreground">
            Upload the resume you&apos;re using for this role. We extract the text for
            you to review, save it to the role, then you can analyze the match.
          </p>
          <ResumeUpload roleId={role.id} companyId={role.company_id} />
        </div>
      ) : null}

      {!alignment ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {busy
            ? "Matching your resume against the JD in the background — you can keep working; this updates when it's done."
            : "Upload or paste your resume, then analyze how it matches this JD — per-requirement coverage, ATS keyword gaps, and concrete next steps."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
          {busy ? (
            <p className="rounded-md border border-dashed bg-surface-0/40 px-3 py-2 text-xs text-muted-foreground">
              Re-analyzing in the background — you can navigate away; this refreshes
              when it&apos;s done.
            </p>
          ) : null}
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
