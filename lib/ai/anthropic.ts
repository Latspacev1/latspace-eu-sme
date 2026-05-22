// Anthropic SDK client — module-scoped singleton. Use only on the server.

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

// Sonnet 4.6 — best balance of tool-use accuracy and latency for this
// single-shot chart-spec generation. Opus 4.7 is reserved for tasks where
// the extra reasoning materially changes the answer; here, the catalogue is
// small and the tool schema does most of the work.
export const DASHBOARD_MODEL = "claude-sonnet-4-6";
