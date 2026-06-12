import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="font-display text-sm font-semibold tracking-tight transition-colors hover:text-primary"
            >
              InterviewBrain
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                Applications
              </Link>
              <Link
                href="/stories"
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                Story bank
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu fullName={profile?.full_name ?? null} email={user.email ?? ""} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
