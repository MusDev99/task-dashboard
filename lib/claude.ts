import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-only client for the Claude API (Smart assign). The key never reaches the browser.
// Without ANTHROPIC_API_KEY the feature falls back to the deterministic rules.
export const SMART_ASSIGN_MODEL = process.env.SMART_ASSIGN_MODEL?.trim() || "claude-opus-5-5";

let client: Anthropic | null = null;

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY?.trim();

function getClient(): Anthropic {
  // Doherty: a slow model must not hang the drawer; the caller falls back to the rules on timeout.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim(), timeout: 20_000, maxRetries: 1 });
  return client;
}

/** One structured-output request. Returns the JSON text, or null on refusal / truncation / empty answer. */
export async function completeJson(system: string, user: string, schema: Record<string, unknown>): Promise<string | null> {
  const res = await getClient().beta.messages.create({
    model: SMART_ASSIGN_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : null;
}
