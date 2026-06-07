// Fill mode handler. Mirrors extract.ts (same query options + NDJSON event
// loop) but instead of a document it serialises the org's measured input
// catalogue and the derivable VSME target cells into a text instruction. The
// agent searches the VSME guidance for methodology, then authors formulas over
// the input codes and calls the propose_fill MCP tool exactly once.
//
// The sandbox has NO database access — all inputs arrive in the job and the
// proposal is committed app-side (lib/metrics/commitProposal.ts), same security
// boundary as extract.

import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  createAgentMcpServer,
  toolSearchGuidance,
  toolProposeFill,
  type FillProposal,
  type RetrievedSource,
} from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import type { FillJob, EmitFn } from "./types.ts";

function formatInputs(job: FillJob): string {
  if (!job.inputs.length) return "INPUTS: (none — the org has no input parameters yet)";
  const lines = job.inputs.map((p) => {
    const val = p.has_value && p.value_annual != null ? String(p.value_annual) : "(no value)";
    return `- ${p.code} | ${p.display_name} | ${p.unit} | ${p.category} | annual=${val}`;
  });
  return `INPUTS (measured values you may build formulas from):\n${lines.join("\n")}`;
}

function formatExistingOutputs(job: FillJob): string {
  if (!job.existingOutputs.length) return "EXISTING OUTPUTS: (none)";
  const lines = job.existingOutputs.map(
    (p) =>
      `- ${p.code} | ${p.display_name} | ${p.unit} | section=${p.section} | cell=${p.vsme_cell ?? "—"} | ${p.has_active_formula ? "HAS FORMULA (skip)" : "no formula"}`,
  );
  return `EXISTING OUTPUTS (reuse codes; skip ones that already have a formula):\n${lines.join("\n")}`;
}

function formatTargets(job: FillJob): string {
  const derivable = job.targets.filter((t) => !t.occupied);
  if (!derivable.length) return "TARGETS: (none available — every mappable cell is already filled)";
  const lines = derivable.map((t) => {
    const hint = t.methodology_hint ? ` — hint: ${t.methodology_hint}` : "";
    return `- ${t.vsme_cell} → ${t.question_id} "${t.question_label}" [field: ${t.field_id}]${hint}`;
  });
  const occupied = job.targets.filter((t) => t.occupied).length;
  const occupiedNote = occupied ? `\n(${occupied} other target(s) are already filled by the user and omitted.)` : "";
  return `TARGETS (VSME cells you may fill — pin each output parameter's vsme_cell to one of these verbatim):\n${lines.join("\n")}${occupiedNote}`;
}

export async function handleFill(job: FillJob, emit: EmitFn): Promise<void> {
  const framework = resolveRagFramework(job.framework);

  const instruction = `Reporting period: ${job.period.label} (${job.period.code}).

${formatInputs(job)}

${formatExistingOutputs(job)}

${formatTargets(job)}

For every target you can derive from the INPUTS, search the guidance for its methodology, then author an output parameter (pinned to the target's vsme_cell) and a formula over the input codes. Skip targets whose inputs are missing. Call propose_fill exactly once when done.`;

  async function* once(): AsyncIterable<SDKUserMessage> {
    yield {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: instruction }],
      } as MessageParam,
      parent_tool_use_id: null,
    };
  }

  const abortController = new AbortController();

  // Stream retrieved guidance sources to the client (same dedupe as chat).
  const seenSources = new Set<string>();
  const onSearchHit = (sources: RetrievedSource[]) => {
    const fresh = sources.filter((s) => {
      const key = `${s.section}|${s.pages}`;
      if (seenSources.has(key)) return false;
      seenSources.add(key);
      return true;
    });
    if (fresh.length) emit("retrieved", fresh);
  };

  let proposal: FillProposal | null = null;
  const onFill = (p: FillProposal) => {
    proposal = p;
  };

  const mcpServer = createAgentMcpServer(framework, { onSearchHit, onFill });

  const q = query({
    prompt: once(),
    options: {
      model: "claude-opus-4-7",
      systemPrompt: getSystemPrompt(framework, "fill", job.businessContext),
      mcpServers: { [framework]: mcpServer },
      allowedTools: [toolSearchGuidance(framework), toolProposeFill(framework)],
      settingSources: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      includePartialMessages: false,
      // Deriving many VSME cells means a long chain of guidance lookups before
      // the single propose_fill call; give it ample turns.
      maxTurns: 24,
      abortController,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `${framework}-fill/1.0` },
    },
  });

  const seenBlockText = new Map<string, number>();
  const seenToolUseIds = new Set<string>();
  const toolErrorMessages: string[] = [];

  try {
    for await (const msg of q) {
      if (msg.type === "assistant") {
        const blocks = msg.message.content ?? [];
        const acc: string[] = [];
        for (const b of blocks) {
          if (b.type === "text") {
            acc.push(b.text);
          } else if (b.type === "tool_use") {
            if (!seenToolUseIds.has(b.id)) {
              seenToolUseIds.add(b.id);
              emit("activity", describeToolUse(b.name, b.input, framework));
            }
          }
        }
        const fullText = acc.join("");
        const prev = seenBlockText.get(msg.uuid) ?? 0;
        if (fullText.length > prev) {
          const delta = fullText.slice(prev);
          seenBlockText.set(msg.uuid, fullText.length);
          if (delta) emit("text", { text: delta });
        }
      } else if (msg.type === "user" && msg.tool_use_result !== undefined) {
        const r = msg.tool_use_result as
          | { isError?: boolean; content?: Array<{ text?: string }> }
          | undefined;
        if (r?.isError) {
          toolErrorMessages.push(r.content?.[0]?.text ?? "tool error");
        }
      } else if (msg.type === "result") {
        if (msg.subtype !== "success") {
          const errs = [...(msg.errors ?? []), ...toolErrorMessages];
          emit("error", { message: errs.join(" | ") || msg.subtype });
          return;
        }
        if (!proposal) {
          emit("error", { message: "Model did not call propose_fill." });
          return;
        }
        emit("proposal", proposal);
        emit("done", {
          stop_reason: msg.stop_reason,
          usage: msg.usage,
          cost_usd: msg.total_cost_usd,
        });
      }
    }
  } finally {
    abortController.abort();
  }
}
