"use client";

import { useState, useTransition } from "react";
import { GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateRoundPlan } from "@/lib/vault/actions";
import { ROUND_TYPES } from "@/lib/vault/constants";
import { roundPlan, type Role, type RoundPlanEntry } from "@/lib/vault/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Editable round plan template for a role. Each new interview snapshots these
// entries into its own rounds.
export function RoundPlanEditor({ role }: { role: Role }) {
  const [entries, setEntries] = useState<RoundPlanEntry[]>(() => roundPlan(role));
  // Baseline the plan was last saved at; each role page is a fresh mount, so
  // deriving this from state (not a ref/effect) is correct.
  const [saved, setSaved] = useState<string>(() => JSON.stringify(roundPlan(role)));
  const [isPending, startSaving] = useTransition();

  const dirty = JSON.stringify(entries) !== saved;

  function add() {
    setEntries((e) => [...e, { name: "", type: "behavioral" }]);
  }
  function remove(i: number) {
    setEntries((e) => e.filter((_, idx) => idx !== i));
  }
  function update(i: number, patch: Partial<RoundPlanEntry>) {
    setEntries((e) => e.map((entry, idx) => (idx === i ? { ...entry, ...patch } : entry)));
  }

  function save() {
    const cleaned = entries
      .map((e) => ({ name: e.name.trim(), type: e.type }))
      .filter((e) => e.name.length > 0);
    const fd = new FormData();
    fd.set("id", role.id);
    fd.set("company_id", role.company_id);
    fd.set("round_plan", JSON.stringify(cleaned));
    startSaving(async () => {
      const res = await updateRoundPlan({ error: null }, fd);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Round plan saved");
        setSaved(JSON.stringify(cleaned));
        setEntries(cleaned);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-surface-0/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No rounds planned yet. Add the recruiter screen, then the loop.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 sm:flex-nowrap"
            >
              <GripVertical className="size-4 shrink-0 text-text-3" aria-hidden />
              <span className="font-mono text-xs text-text-3">R{i + 1}</span>
              <Input
                aria-label={`Round ${i + 1} name`}
                value={entry.name}
                placeholder="Round name (e.g. Product sense loop)"
                onChange={(e) => update(i, { name: e.target.value })}
                className="min-w-40 flex-1"
              />
              <Select
                aria-label={`Round ${i + 1} type`}
                value={entry.type}
                onChange={(e) => update(i, { type: e.target.value })}
                className="w-40"
              >
                {ROUND_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove round ${i + 1}`}
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus /> Add round
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!dirty || isPending}
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Save />} Save plan
        </Button>
      </div>
    </div>
  );
}
