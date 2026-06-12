import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Lightbulb, MessageSquareText, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getApplications, type Application } from "@/lib/applications/queries";
import { MAX_ACTIVE_APPLICATIONS } from "@/lib/applications/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .single()
    : { data: null };

  const firstName = profile?.full_name?.split(/\s+/)[0];

  const applications = await getApplications();
  const active = applications.filter((a) => !a.is_archived);
  const archived = applications.filter((a) => a.is_archived);
  const atCap = active.length >= MAX_ACTIVE_APPLICATIONS;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your applications, sessions, and insights live here.
          </p>
        </div>
        {atCap ? (
          <Button
            variant="outline"
            disabled
            title={`Free plan is capped at ${MAX_ACTIVE_APPLICATIONS} active applications`}
          >
            <Plus /> New application
          </Button>
        ) : (
          <Button asChild>
            <Link href="/applications/new">
              <Plus /> New application
            </Link>
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">Applications</h2>
          <span className="text-sm text-muted-foreground">
            {active.length} of {MAX_ACTIVE_APPLICATIONS} active
          </span>
        </div>

        {applications.length === 0 ? (
          <Card>
            <CardHeader>
              <FolderOpen className="size-5 text-primary" aria-hidden />
              <CardTitle>No applications yet</CardTitle>
              <CardDescription>
                Create your first vault — paste a JD and your resume, and
                you&apos;re ready to practice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/applications/new">
                  <Plus /> New application
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...active, ...archived].map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <MessageSquareText className="size-5 text-primary" aria-hidden />
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>
              Mock interviews built from your actual materials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run your first mock from an application to see sessions here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Lightbulb className="size-5 text-primary" aria-hidden />
            <CardTitle>Top insight</CardTitle>
            <CardDescription>
              What the brain notices across your applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Insights appear once the brain has a few sessions to learn from.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  return (
    <Link href={`/applications/${app.id}`} className="group block">
      <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{app.company_name}</CardTitle>
            {app.is_archived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : null}
          </div>
          <CardDescription className="truncate">
            {app.role_title}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
