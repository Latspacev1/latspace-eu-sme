// Fill mode handler. Runs the OpenAI Agents SDK agent with search_guidance +
// propose_fill. It serialises the org's measured input catalogue and the
// derivable VSME target cells into a text instruction; the agent searches the
// VSME guidance for methodology, authors formulas over the input codes, and
// calls propose_fill exactly once.
//
// The sandbox has NO database access — all inputs arrive in the job and the
// proposal is committed app-side (lib/metrics/commitProposal.ts), same security
// boundary as extract.

import type { AgentInputItem } from "@openai/agents";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  createAgentTools,
  type FillProposal,
  type RetrievedSource,
} from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { runAgentStreaming } from "./runAgent.ts";
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

  const input: AgentInputItem[] = [{ role: "user", content: instruction }];

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

  const tools = createAgentTools(framework, { onSearchHit, onFill });

  try {
    await runAgentStreaming({
      model: "gpt-5",
      instructions: getSystemPrompt(framework, "fill", job.businessContext),
      tools,
      input,
      // Deriving many VSME cells means a long chain of guidance lookups before
      // the single propose_fill call; give it ample turns.
      maxTurns: 24,
      framework,
      emit,
    });
  } catch (err) {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!proposal) {
    emit("error", { message: "Model did not call propose_fill." });
    return;
  }
  emit("proposal", proposal);
  emit("done", {});
}
