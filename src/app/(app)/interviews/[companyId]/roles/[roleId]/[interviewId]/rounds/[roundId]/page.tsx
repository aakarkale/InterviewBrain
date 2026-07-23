import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getRound } from "@/lib/interviews/queries";
import { PageHeader } from "@/components/app/page-header";
import { RoundEditor } from "@/components/interviews/round-editor";
import { RoundCoachingPanel } from "@/components/interviews/round-coaching-panel";

// Saving a real-round outcome triggers background brain regeneration.
export const maxDuration = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roundId: string }>;
}): Promise<Metadata> {
  const { roundId } = await params;
  const data = await getRound(roundId);
  return {
    title: data
      ? `${data.round.round_name ?? "Round"} · ${data.interview.label}`
      : "Round",
  };
}

export default async function RoundPage({
  params,
}: {
  params: Promise<{
    companyId: string;
    roleId: string;
    interviewId: string;
    roundId: string;
  }>;
}) {
  const { roundId } = await params;
  const data = await getRound(roundId);
  if (!data) notFound();
  const { round, interview, role, company } = data;

  const backHref = `/interviews/${company.id}/roles/${role.id}/${interview.id}`;
  const title =
    round.round_name ?? `Round ${round.round_number} · ${round.round_type.replace("_", " ")}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {interview.label}
      </Link>
      <PageHeader
        title={title}
        description={`${company.name} · ${role.title}`}
      />
      <RoundEditor round={round} backHref={backHref} />

      <div className="border-t pt-2">
        <RoundCoachingPanel round={round} />
      </div>
    </div>
  );
}
