import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { ProfileForm } from "@/components/app/profile-form";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Settings" description="Account and preferences." />

      <div className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
        <section className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Account</h2>
            <p className="font-mono text-xs text-text-3">{user.email}</p>
          </div>
          <ProfileForm fullName={profile?.full_name ?? null} />
        </section>

        <section className="flex items-center justify-between gap-4 p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Dark, or the brutalist light variant.
            </p>
          </div>
          <ThemeToggle />
        </section>

        <section className="flex items-center justify-between gap-4 p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Session</h2>
            <p className="text-sm text-muted-foreground">
              Sign out of InterviewBrain on this device.
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
