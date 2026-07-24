import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { fingerprint } from "@/lib/vault/fingerprint";
import { generateRoleAlignment } from "@/lib/vault/role-alignment";

// The generation itself (two AI passes) runs in an after() callback, so the
// serverless invocation must stay alive well past the immediate response.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Rough wall-clock for the two-pass match, shown to the user as a countdown.
const ESTIMATE_SECONDS = 45;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// GET — lightweight poll. Returns the role's current alignment timestamp so the
// client can detect when a background run has written a fresh result (the
// timestamp strictly advances on every completed generation).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Not signed in.", 401);

  const { data: role } = await supabase
    .from("roles")
    .select("id, alignment_generated_at")
    .eq("id", roleId)
    .maybeSingle();
  if (!role) return jsonError("Role not found.", 404);

  return Response.json({ generated_at: role.alignment_generated_at });
}

// POST { force?: boolean } — start (or refresh) the resume↔JD match. Returns
// immediately; the AI work runs in after() so the request never blocks the
// client's router, letting the user navigate away while it runs. The result is
// cached to roles.alignment and picked up by the client's poll or a page load.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;

  let force = false;
  try {
    const body = await request.json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch {
    force = false;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Not signed in.", 401);

  // RLS returns only the owner's role.
  const { data: role } = await supabase
    .from("roles")
    .select(
      "id, company_id, title, job_description, resume, linkedin_profile, research_notes, alignment, alignment_input_fingerprint, alignment_generated_at, companies(name)"
    )
    .eq("id", roleId)
    .maybeSingle();
  if (!role) return jsonError("Role not found.", 404);

  if (!role.resume?.trim() || !role.job_description?.trim()) {
    return jsonError("Add a resume and job description first.", 400);
  }

  const fp = fingerprint(
    role.job_description,
    role.resume,
    role.linkedin_profile,
    role.research_notes
  );

  // Unchanged inputs with a cached result: nothing to do.
  if (!force && role.alignment && role.alignment_input_fingerprint === fp) {
    return Response.json({
      status: "fresh",
      generated_at: role.alignment_generated_at,
    });
  }

  const companyName =
    (role.companies as { name: string } | null)?.name ?? "the company";
  const input = {
    companyName,
    roleTitle: role.title,
    jobDescription: role.job_description,
    resume: role.resume,
    linkedin: role.linkedin_profile,
    research: role.research_notes,
  };
  const companyId = role.company_id;

  // Runs after the response is flushed; the client is already free to navigate.
  after(async () => {
    try {
      const result = await generateRoleAlignment(input);
      if (!result) return; // leave the timestamp unchanged → client times out

      const generated_at = new Date().toISOString();
      await supabase
        .from("roles")
        .update({
          alignment: { ...result, sources: [], generated_at },
          alignment_generated_at: generated_at,
          alignment_input_fingerprint: fp,
        })
        .eq("id", roleId);

      // Refresh any cached render of the role page for navigations elsewhere;
      // the originating client also router.refresh()es when its poll succeeds.
      revalidatePath(`/vault/${companyId}/roles/${roleId}`);
    } catch {
      // generateRoleAlignment already fails soft; nothing else to do.
    }
  });

  return Response.json({
    status: "pending",
    estimate_seconds: ESTIMATE_SECONDS,
    baseline_generated_at: role.alignment_generated_at,
  });
}
