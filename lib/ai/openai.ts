// OpenAI SDK client — module-scoped singleton. Use only on the server.

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

// gpt-4.1 — best balance of tool-use accuracy and latency for this single-shot
// chart-spec generation. The catalogue is small and the tool schema does most
// of the work, so the reasoning headroom of a larger model isn't needed here.
export const DASHBOARD_MODEL = "gpt-4.1";
