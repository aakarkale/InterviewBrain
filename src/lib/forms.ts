// Shared server-action form helpers + result type. Client-safe (no server-only
// import) so form components can import ActionState.

export type ActionState = { error: string | null; success?: boolean };

export const actionSuccess: ActionState = { error: null, success: true };

export function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function nullableField(formData: FormData, key: string): string | null {
  const value = field(formData, key);
  return value.length > 0 ? value : null;
}
