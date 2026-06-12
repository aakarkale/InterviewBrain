import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getInsights } from "@/lib/brain/queries";
import { BrainView } from "@/components/brain/brain-view";

export const metadata: Metadata = { title: "Brain" };

// refreshBrain runs the cross-application extraction (an AI call); give its
// server action headroom beyond the default timeout.
export const maxDuration = 300;

export default async function BrainPage() {
  const supabase = await createClient();
  const [insights, { data: competencies }] = await Promise.all([
    getInsights(),
    supabase.from("competencies").select("id, name"),
  ]);

  const competencyNames = Object.fromEntries(
    (competencies ?? []).map((c) => [c.id, c.name])
  );

  return <BrainView insights={insights} competencyNames={competencyNames} />;
}
