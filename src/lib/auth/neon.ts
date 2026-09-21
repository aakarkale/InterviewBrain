import "server-only";

import { createNeonAuth } from "@neondatabase/neon-js/auth/next/server";

import type { createClient } from "@/lib/db/server";

type NeonAuthInstance = ReturnType<typeof createNeonAuth>;
type DataApiClient = Awaited<ReturnType<typeof createClient>>;

// createNeonAuth validates cookies.secret eagerly and throws without it, so it
// is built on first use rather than at module load. A deployment whose env
// vars aren't configured yet (a fresh preview, or `next build` in CI) must
// still build and serve public pages instead of failing outright -- the same
// guarantee the previous Supabase proxy made.
let instance: NeonAuthInstance | null = null;

export function hasAuthEnv(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET
  );
}

export function getAuth(): NeonAuthInstance {
  if (!instance) {
    instance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    });
  }
  return instance;
}

// Every method reads the *current request's* cookies via Next's request
// context, so sessions never leak between requests despite the shared
// instance. Safe in Server Components, Server Actions, Route Handlers, and
// middleware.
export const auth = new Proxy({} as NeonAuthInstance, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth() as object, prop, receiver);
  },
});

// The Data API authenticates with a JWT that Postgres verifies; its `sub`
// claim is what auth.uid() returns inside every RLS policy. Returns null when
// signed out so reads fail closed.
//
// The SDK is pre-1.0 and its token response shape isn't in the published
// types, so read it tolerantly rather than trusting one field name.
export async function getDataApiToken(): Promise<string | null> {
  if (!hasAuthEnv()) return null;
  try {
    const res: unknown = await getAuth().token();
    if (typeof res === "string") return res;
    if (res && typeof res === "object") {
      const r = res as { data?: unknown; token?: unknown };
      if (typeof r.token === "string") return r.token;
      const d = r.data as { token?: unknown } | undefined;
      if (d && typeof d.token === "string") return d.token;
    }
    return null;
  } catch {
    return null;
  }
}

// The signed-in user for this request, or null. Replaces Supabase's
// supabase.auth.getUser().
export async function getUser() {
  if (!hasAuthEnv()) return null;
  try {
    const { data } = await getAuth().getSession();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

// Neon Auth owns identity in the neon_auth schema; public.users holds the
// app's own profile fields and is the FK target for every owned row. Supabase
// created that row from a trigger on auth.users, which has no equivalent here,
// so the app mirrors it on first authenticated page load.
export async function ensureProfile(
  db: DataApiClient,
  user: { id: string; name?: string | null }
) {
  try {
    const { data } = await db
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (data) return;
    await db.from("users").insert({ id: user.id, full_name: user.name ?? null });
  } catch {
    // Never block rendering on profile mirroring.
  }
}
