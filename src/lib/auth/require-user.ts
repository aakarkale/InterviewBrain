import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { getUser } from "@/lib/auth/neon";

// Shared server-action guard: returns the RLS-scoped Data API client and the
// current user, or redirects to login.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  const db = await createClient();
  return { db, user };
}
