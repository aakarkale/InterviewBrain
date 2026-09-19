"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/neon";
import { createClient } from "@/lib/db/server";
import { safeNext } from "@/lib/auth/redirect";

export type AuthState = {
  error: string | null;
  message?: string | null;
};

async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// The SDK is pre-1.0 and its error shape isn't fully typed; read it tolerantly
// so a failed sign-in never surfaces as "undefined".
function errorMessage(res: unknown, fallback: string): string | null {
  if (!res || typeof res !== "object") return null;
  const e = (res as { error?: unknown }).error;
  if (!e) return null;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const res = await auth.signIn.email({ email, password });
  const error = errorMessage(res, "Could not sign you in.");
  if (error) return { error };

  redirect(safeNext(formData.get("next")));
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName) {
    return { error: "Your name is required." };
  }
  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const res = await auth.signUp.email({ email, password, name: fullName });
  const error = errorMessage(res, "Could not create your account.");
  if (error) return { error };

  // With email verification on, there's no session until the link is clicked.
  const session = await auth.getSession().catch(() => null);
  if (!session?.data?.user) {
    return {
      error: null,
      message: "Check your inbox — we sent you a confirmation link.",
    };
  }

  redirect("/dashboard");
}

export async function signInWithGoogle(formData: FormData) {
  const origin = await getOrigin();
  const next = safeNext(formData.get("next"));

  const res = await auth.signIn.social({
    provider: "google",
    callbackURL: `${origin}${next}`,
  });

  const error = errorMessage(res, "Could not start Google sign-in.");
  if (error) redirect(`/login?error=${encodeURIComponent(error)}`);

  // Neon Auth returns the provider URL to hand the browser off to.
  const url = (res as { data?: { url?: string }; url?: string } | null)?.data?.url
    ?? (res as { url?: string } | null)?.url;
  if (!url) redirect(`/login?error=${encodeURIComponent("Google sign-in is unavailable.")}`);
  redirect(url);
}

export async function signOut() {
  await auth.signOut().catch(() => null);
  redirect("/");
}

export type ProfileState = {
  error: string | null;
  success: boolean;
};

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName) {
    return { error: "Your name can't be empty.", success: false };
  }

  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) redirect("/login");

  // Keep the identity record and the app's profile row in step.
  await auth.updateUser({ name: fullName }).catch(() => null);

  const db = await createClient();
  const { error } = await db
    .from("users")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
