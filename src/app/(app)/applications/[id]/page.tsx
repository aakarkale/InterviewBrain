import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Legacy redirect: old /applications/:id links now point at the migrated
// interview (or its role). Kept for one release so demo bookmarks survive.
export default async function LegacyApplicationRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, role_id, roles(company_id)")
    .eq("legacy_application_id", id)
    .maybeSingle();

  if (interview) {
    const companyId = (interview.roles as { company_id: string } | null)?.company_id;
    if (companyId) {
      redirect(`/interviews/${companyId}/roles/${interview.role_id}/${interview.id}`);
    }
  }

  const { data: role } = await supabase
    .from("roles")
    .select("id, company_id")
    .eq("legacy_application_id", id)
    .maybeSingle();

  if (role) redirect(`/vault/${role.company_id}/roles/${role.id}`);

  notFound();
}
