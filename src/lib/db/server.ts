import "server-only";

import { createClient as createNeonClient } from "@neondatabase/neon-js";

import { getDataApiToken } from "@/lib/auth/neon";
import type { Database } from "./database.types";

// Per-request Neon Data API client. The Data API is PostgREST-compatible, so
// the query surface (.from().select().eq() ...) is unchanged from Supabase.
//
// Built fresh per request and given a lazy getToken rather than a shared
// module-level client: the JWT is this request's, and its `sub` claim is what
// auth.uid() resolves to inside every RLS policy. A signed-out request gets a
// null token and RLS returns nothing, so reads fail closed.
export async function createClient() {
  return createNeonClient<Database>({
    dataApi: {
      url: process.env.NEON_DATA_API_URL!,
      getToken: getDataApiToken,
    },
  });
}
