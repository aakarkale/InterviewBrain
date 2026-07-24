// Cheap deterministic fingerprint (djb2) so we don't re-run — and re-bill — a
// generator when its inputs are unchanged. Shared by the insight actions and
// the role-alignment route handler.
export function fingerprint(
  ...parts: (string | boolean | null | undefined)[]
): string {
  const s = parts.map((p) => String(p ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
