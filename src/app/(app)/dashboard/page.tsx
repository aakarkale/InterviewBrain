import type { Metadata } from "next";
import { FolderOpen, Lightbulb, MessageSquareText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your applications, sessions, and insights will live here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <FolderOpen className="size-5 text-primary" aria-hidden />
            <CardTitle>Applications</CardTitle>
            <CardDescription>
              One vault per company — JD, resume, research, rounds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The application vault arrives in Phase 2.
            </p>
          </CardContent>
        </Card>

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
              The session engine arrives in Phase 2.
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
              The brain arrives in Phase 2.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
