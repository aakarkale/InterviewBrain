import { getAuth } from "@/lib/auth/neon";

// Neon Auth's endpoints (sign-in, sign-up, OAuth callback, email
// verification, token issuance). Mounting this replaces the hand-written
// /auth/callback and /auth/confirm routes Supabase needed: the OAuth code
// exchange and email confirmation are handled here.
//
// The handler is built per request so a build without auth env vars doesn't
// fail while collecting page data.
type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx) {
  return getAuth().handler().GET(request, ctx);
}

export async function POST(request: Request, ctx: Ctx) {
  return getAuth().handler().POST(request, ctx);
}
