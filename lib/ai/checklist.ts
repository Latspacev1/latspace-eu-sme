// Checklist — generates the VSME "data checklist" for a company: the concrete
// data points / documents the org needs to COLLECT to fill a VSME document,
// grouped into Environmental, Social, Governance, and General Information.
// Server-only.
//
// Unlike Sculptor (which researches the web), this is a single-shot synthesis
// grounded in the company name and its already-generated business context. It
// uses Claude with a FORCED tool (`emit_checklist`) so the output is structured
// JSON we can persist directly, rather than prose we'd have to parse.

import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "@/lib/ai/anthropic";
import {
  normalizeStoredChecklist,
  type VsmeChecklist,
} from "@/lib/types/checklist";

// Opus is reserved elsewhere for reasoning-heavy work; for the checklist we want
// reliable structured synthesis of well-known VSME data points, so Sonnet 4.6 is
// the right balance of quality and latency. The forced tool does the heavy
// lifting of shaping the output.
const CHECKLIST_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = [
  "You are a VSME (EFRAG Voluntary Sustainability Reporting Standard for SMEs) reporting expert.",
  "",
  "Your task: list the concrete DATA POINTS and documents a company needs to COLLECT in order to fill a VSME document. Group every item into exactly one of four categories: Environmental, Social, Governance, and General Information.",
  "",
  "Rules:",
  "- Each item is a short title — a few words only (e.g. 'Total energy consumption (kWh)', 'Employee headcount by gender', 'Anti-corruption policy').",
  "- No numbering, no bullets, no prose, no explanations — just the title of the data point or document.",
  "- Be specific and practical: name the actual figures, records, and documents an SME would have to gather.",
  "- Cover each category thoroughly but do not pad with duplicates or irrelevant items.",
  "- Call the emit_checklist tool exactly once with the four arrays.",
].join("\n");

/** The forced tool — its schema is the checklist shape we want back as JSON. */
const emitChecklistTool: Anthropic.Messages.Tool = {
  name: "emit_checklist",
  description:
    "Emit the VSME data checklist: the data points / documents to collect, grouped into the four categories.",
  input_schema: {
    type: "object",
    properties: {
      environmental: { type: "array", items: { type: "string" } },
      social: { type: "array", items: { type: "string" } },
      governance: { type: "array", items: { type: "string" } },
      general: { type: "array", items: { type: "string" } },
    },
    required: ["environmental", "social", "governance", "general"],
  },
};

export interface ChecklistInput {
  companyName: string;
  businessContext?: string;
  vsmeModules?: "basic" | "basic_comprehensive";
}

/**
 * Run the checklist generator for a company. Throws on an Anthropic/network
 * error or if the model returns no tool output (callers treat this as
 * best-effort and continue without updating the stored checklist).
 */
export async function runChecklist(input: ChecklistInput): Promise<VsmeChecklist> {
  const client = getAnthropicClient();

  const scopeLine =
    input.vsmeModules === "basic_comprehensive"
      ? "Modules in scope: Basic (B1–B11) plus Comprehensive (C1–C9)."
      : input.vsmeModules === "basic"
        ? "Modules in scope: Basic (B1–B11)."
        : null;

  const userPrompt = [
    "What data points need to be collected to fill a VSME document for this company, categorised for: Environmental, Social, Governance and General Information.",
    "",
    `Company name: ${input.companyName}`,
    ...(scopeLine ? [scopeLine] : []),
    ...(input.businessContext
      ? ["", "Business context:", input.businessContext]
      : []),
  ].join("\n");

  const message = await client.messages.create({
    model: CHECKLIST_MODEL,
    max_tokens: 2048,
    // Single cached system block — the instructions are static across calls.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [emitChecklistTool],
    tool_choice: { type: "tool", name: "emit_checklist" },
    messages: [{ role: "user", content: userPrompt }],
  });

  // The SDK content blocks are a union; find the forced tool's call narrowly.
  const toolUse = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "emit_checklist",
  );

  if (!toolUse) {
    throw new Error("Checklist generation produced no output.");
  }

  // normalizeStoredChecklist would read generatedAt from the tool input (the
  // model doesn't emit one), so stamp it ourselves.
  return {
    ...normalizeStoredChecklist(toolUse.input as Partial<VsmeChecklist>),
    generatedAt: new Date().toISOString(),
  };
}
