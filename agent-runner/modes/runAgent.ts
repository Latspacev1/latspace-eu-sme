// Shared OpenAI Agents SDK run loop for all four modes. Replaces the per-mode
// Claude Agent SDK `query()` loop. It runs the agent in streaming mode and maps
// the SDK's stream events onto the runner's NDJSON `emit()` events:
//
//   raw_model_stream_event  (output_text_delta)  → emit("text")
//   run_item_stream_event   (tool_called)        → emit("activity")
//
// Proposals and retrieved sources are forwarded by the tool `execute` callbacks
// (see lib/agent/tools.ts), not from here. The caller emits "done"/"error"
// around this based on whether the expected proposal arrived.

import { Agent, run, type AgentInputItem, type Tool } from "@openai/agents";
import type { Framework } from "../lib/retrieval.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import type { EmitFn } from "./types.ts";

export interface RunAgentOptions {
  model: string;
  instructions: string;
  tools: Tool[];
  input: AgentInputItem[];
  maxTurns: number;
  framework: Framework;
  emit: EmitFn;
}

/**
 * Run an agent to completion in streaming mode, emitting text + activity events
 * as they arrive. Resolves when the run finishes. Throws on a run error (the
 * caller maps that to an "error" NDJSON event).
 */
export async function runAgentStreaming(opts: RunAgentOptions): Promise<void> {
  const agent = new Agent({
    name: `${opts.framework}-agent`,
    model: opts.model,
    instructions: opts.instructions,
    tools: opts.tools,
  });

  const result = await run(agent, opts.input, {
    stream: true,
    maxTurns: opts.maxTurns,
  });

  const seenToolCallIds = new Set<string>();

  for await (const event of result) {
    if (event.type === "raw_model_stream_event") {
      // The SDK normalizes the Responses event name to "output_text_delta"
      // (the original "response.output_text.delta" lives under providerData).
      const data = event.data as { type?: string; delta?: unknown };
      if (data.type === "output_text_delta" && typeof data.delta === "string" && data.delta) {
        opts.emit("text", { text: data.delta });
      }
      continue;
    }

    if (event.type === "run_item_stream_event" && event.name === "tool_called") {
      const raw = event.item.rawItem as
        | { type?: string; callId?: string; id?: string; name?: string; arguments?: string }
        | undefined;
      if (!raw) continue;
      const id = raw.callId ?? raw.id ?? "";
      if (id && seenToolCallIds.has(id)) continue;
      if (id) seenToolCallIds.add(id);
      let parsedArgs: unknown = {};
      if (typeof raw.arguments === "string") {
        try {
          parsedArgs = JSON.parse(raw.arguments);
        } catch {
          parsedArgs = {};
        }
      }
      opts.emit("activity", describeToolUse(raw.name ?? "tool", parsedArgs, opts.framework));
    }
  }

  // Surface a run-level error (e.g. MaxTurnsExceeded) to the caller.
  await result.completed;
}
