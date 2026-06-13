// Checklist — generates the VSME "data checklist" for a company: the concrete
// data points / documents the org needs to COLLECT to fill a VSME document,
// grouped into Environmental, Social, Governance, and General Information.
// Server-only.
//
// Unlike Sculptor (which researches the web), this is a single-shot synthesis
// grounded in the company name and its already-generated business context. It
// uses the OpenAI Responses API with a structured-output JSON schema so the
// result is structured JSON we can persist directly, rather than prose we'd
// have to parse.

import { getOpenAIClient } from "@/lib/ai/openai";
import {
  normalizeStoredChecklist,
  type VsmeChecklist,
} from "@/lib/types/checklist";

// gpt-4.1 gives reliable structured synthesis of well-known VSME data points at
// good latency; the JSON schema does the heavy lifting of shaping the output.
const CHECKLIST_MODEL = "gpt-4.1";

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
  "- Return the four arrays via the structured output schema.",
].join("\n");

// The structured-output schema is the checklist shape we want back as JSON.
const CHECKLIST_JSON_SCHEMA = {
  type: "object",
  properties: {
    environmental: { type: "array", items: { type: "string" } },
    social: { type: "array", items: { type: "string" } },
    governance: { type: "array", items: { type: "string" } },
    general: { type: "array", items: { type: "string" } },
  },
  required: ["environmental", "social", "governance", "general"],
  additionalProperties: false,
} as const;

export interface ChecklistInput {
  companyName: string;
  businessContext?: string;
  vsmeModules?: "basic" | "basic_comprehensive";
}

/**
 * Run the checklist generator for a company. Throws on an OpenAI/network error
 * or if the model returns no usable output (callers treat this as best-effort
 * and continue without updating the stored checklist).
 */
export async function runChecklist(input: ChecklistInput): Promise<VsmeChecklist> {
  const client = getOpenAIClient();

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

  const response = await client.responses.create({
    model: CHECKLIST_MODEL,
    max_output_tokens: 2048,
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: userPrompt }],
    text: {
      format: {
        type: "json_schema",
        name: "vsme_checklist",
        schema: CHECKLIST_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const text = response.output_text;
  if (!text) {
    throw new Error("Checklist generation produced no output.");
  }

  let parsed: Partial<VsmeChecklist>;
  try {
    parsed = JSON.parse(text) as Partial<VsmeChecklist>;
  } catch {
    throw new Error("Checklist generation returned malformed output.");
  }

  // normalizeStoredChecklist would read generatedAt from the model output (the
  // model doesn't emit one), so stamp it ourselves.
  return {
    ...normalizeStoredChecklist(parsed),
    generatedAt: new Date().toISOString(),
  };
}
