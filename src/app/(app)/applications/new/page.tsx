import { redirect } from "next/navigation";

// Legacy redirect: creating a vault now starts from the Company Vault.
export default function LegacyNewApplicationRedirect() {
  redirect("/vault/new");
}
