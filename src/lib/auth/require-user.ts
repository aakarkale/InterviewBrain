import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Shared server-action guard: returns the RLS-scoped client and the current
// user, or redirects to login. Previously duplicated in applications/actions
// and sessions/actions.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
