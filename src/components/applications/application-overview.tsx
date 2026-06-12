"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";

import { setApplicationArchived } from "@/lib/applications/actions";
import type { Application } from "@/lib/applications/queries";
import { ApplicationForm } from "./application-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ApplicationOverview({
  application,
}: {
  application: Application;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Edit application</h2>
        <ApplicationForm
          application={application}
          onDone={() => setEditing(false)}
        />
      </section>
    );
  }

  const meta = [
    application.hiring_manager &&
      `Hiring manager: ${application.hiring_manager}`,
    application.team_name && `Team: ${application.team_name}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {application.company_name}
            </h1>
            {application.is_archived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">{application.role_title}</p>
          {meta ? (
            <p className="text-sm text-muted-foreground">{meta}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <form action={setApplicationArchived}>
            <input type="hidden" name="id" value={application.id} />
            <input
              type="hidden"
              name="archived"
              value={application.is_archived ? "false" : "true"}
            />
            <Button variant="ghost" size="sm" type="submit">
              {application.is_archived ? (
                <>
                  <ArchiveRestore /> Unarchive
                </>
              ) : (
                <>
                  <Archive /> Archive
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReadBlock title="Job description" body={application.job_description} />
        <ReadBlock title="Resume" body={application.resume} />
      </div>
    </section>
  );
}

function ReadBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
        {body}
      </p>
    </div>
  );
}
