import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app/app-nav";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // the proxy already gates these routes; this is defense in depth
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-13 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              href="/dashboard"
              aria-label="InterviewBrain dashboard"
              className="group flex shrink-0 items-center gap-2"
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-primary font-display text-[11px] font-semibold text-primary-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.15)]">
                ib
              </span>
              <span className="hidden font-display text-sm font-semibold tracking-tight transition-colors group-hover:text-primary md:inline">
                InterviewBrain
              </span>
            </Link>
            <AppNav />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <UserMenu
              fullName={profile?.full_name ?? null}
              email={user.email ?? ""}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
