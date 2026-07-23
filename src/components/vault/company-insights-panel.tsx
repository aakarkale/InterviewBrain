"use client";

import { useActionState, useEffect } from "react";
import { ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateCompanyInsightsAction } from "@/lib/vault/insight-actions";
import type { ActionState } from "@/lib/forms";
import { asCompanyInsights, type Company } from "@/lib/vault/types";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/page-header";

const initialState: ActionState = { error: null };

export function CompanyInsightsPanel({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(
    generateCompanyInsightsAction,
    initialState
  );
  const insights = asCompanyInsights(company.insights);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Company insights"
        description="Web-researched, with sources. Verify anything critical yourself."
        actions={
          <form action={action}>
            <input type="hidden" name="company_id" value={company.id} />
            <input type="hidden" name="force" value={insights ? "true" : "false"} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : insights ? (
                <RefreshCw />
              ) : (
                <Sparkles />
              )}
              {pending ? "Researching…" : insights ? "Refresh" : "Generate"}
            </Button>
          </form>
        }
      />

      {!insights ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {pending
            ? "Searching the web for current, cited details…"
            : "Generate a web-researched brief on this company — overview, funding, leadership" +
              (company.h1b_tracking_enabled ? ", and H-1B sponsorship." : ".")}
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <ul className="flex flex-col divide-y divide-border/70">
            {insights.sections.map((s) => (
              <li key={s.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ul>

          {insights.sources.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <span className="text-micro text-muted-foreground">Sources</span>
              <ul className="flex flex-col gap-1">
                {insights.sources.map((src) => (
                  <li key={src.url}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-micro text-text-3">
            AI-generated from web sources · verify anything you rely on.
          </p>
        </div>
      )}
    </section>
  );
}
