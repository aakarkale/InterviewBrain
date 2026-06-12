import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Locked decision (handoff 2026-06-12): all AI features run on Sonnet 4.6.
export const MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

// The SDK reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL when a proxy is
// configured) from the environment. Lazy so importing this module never
// throws at build time when the key is absent.
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
