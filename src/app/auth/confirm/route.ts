import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirect";

// token_hash verification for emails using the SSR-friendly template
// ({{ .TokenHash }}); works even when the link is opened in a
// different browser than the one that signed up.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const message =
    "Could not verify your email. The link may have expired — please try again.";
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(message)}`
  );
}
