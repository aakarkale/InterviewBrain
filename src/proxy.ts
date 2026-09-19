import { NextResponse, type NextRequest } from "next/server";

import { getAuth, hasAuthEnv } from "@/lib/auth/neon";

// Route protection + session refresh, handled by Neon Auth. Everything the
// matcher covers requires a session; unauthenticated requests land on /login.
export async function proxy(request: NextRequest) {
  // Without auth configured there is no way to establish a session, so send
  // protected traffic to /login rather than 500ing every request.
  if (!hasAuthEnv()) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = {
  matcher: [
    // Protect everything except: the landing page, the auth screens, Neon
    // Auth's own endpoints (which must stay reachable mid sign-in), and
    // static assets.
    "/((?!$|login|signup|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
