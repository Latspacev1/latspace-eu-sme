// Extract mode handler. Mirrors write.ts (same agent run + NDJSON event loop)
// but instead of a report outline it attaches the uploaded document as a native
// input_file / input_image content part so the model can read both the text and
// the page images (handles scanned bills with no separate OCR step), and it
// registers the propose_extraction tool instead of propose_insert.

import type { AgentInputItem } from "@openai/agents";
import { getSystemPrompt } from "../lib/guidance.ts";
import { createAgentTools, type ExtractionProposal } from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { spreadsheetToText } from "../lib/spreadsheet/toText.ts";
import { runAgentStreaming } from "./runAgent.ts";
import type { ExtractJob, EmitFn } from "./types.ts";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

// Spreadsheet uploads can't be sent as a native input_file / input_image block,
// so we serialize them to a coordinate-preserving text block instead (see
// lib/spreadsheet/toText.ts).
const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

function normalizeMime(mime: string): string {
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

// One user-content part: an attached document/image, or serialized spreadsheet
// text, following the OpenAI Responses input-content shapes.
type FileBlock =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image: string }
  | { type: "input_file"; file: string; filename: string };

export async function handleExtract(job: ExtractJob, emit: EmitFn): Promise<void> {
  if (!job.documentUrl) {
    emit("error", { message: "documentUrl is required" });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const mime = normalizeMime(job.mimeType || "application/pdf");

  // Fetch the document bytes from the short-TTL signed URL. We never receive the
  // service key — only the URL. For PDFs/images we base64-encode the bytes into a
  // native vision block; for spreadsheets we serialize to a text block instead.
  let buf: Buffer;
  try {
    const res = await fetch(job.documentUrl);
    if (!res.ok) {
      emit("error", { message: `Failed to fetch document (${res.status})` });
      return;
    }
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    emit("error", { message: `Could not download document: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }

  const isSpreadsheet = SPREADSHEET_TYPES.has(mime);
  const isImage = IMAGE_TYPES.has(mime);

  let fileBlock: FileBlock;

  if (isSpreadsheet) {
    try {
      const sheetText = await spreadsheetToText(buf, mime, job.filename);
      fileBlock = { type: "input_text", text: sheetText };
    } catch (err) {
      emit("error", { message: `Could not read spreadsheet: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
  } else if (isImage) {
    const base64 = buf.toString("base64");
    fileBlock = { type: "input_image", image: `data:${mime};base64,${base64}` };
  } else {
    const base64 = buf.toString("base64");
    fileBlock = {
      type: "input_file",
      file: `data:application/pdf;base64,${base64}`,
      filename: job.filename || "document.pdf",
    };
  }

  const existingText =
    job.existingParameters && job.existingParameters.length
      ? `Existing parameters for this organization — when a metric you find means the SAME thing as one of these, reuse its EXACT code verbatim (do not create a near-duplicate):\n${job.existingParameters
          .map((p) => `- ${p.code} | ${p.display_name} | ${p.unit} | ${p.section}`)
          .join("\n")}`
      : "This organization has no parameters yet — propose fresh codes.";

  // Coding conventions keep codes stable across uploads so the same metric does
  // not fragment into electricity_consumption_total_kwh vs ..._total.
  const codingRules = [
    "Parameter code rules (follow exactly):",
    "- Match by MEANING, not spelling: if a metric equals an existing one above, output that existing code character-for-character — even if your wording or the document's wording differs.",
    "- Never append the unit to the code. Use electricity_consumption_total, NOT electricity_consumption_total_kwh. The unit goes in the `unit` field only.",
    "- snake_case, lowercase, no trailing qualifiers like _annual/_total_kwh; put the quantity word (total/net) before, units never.",
    "- Reuse a code across months/documents for the same metric; only the data point's value/period changes.",
  ].join("\n");

  const instruction = `The uploaded document is "${job.filename}".${
    job.periodHint ? ` The user suggests it covers period "${job.periodHint}".` : ""
  }

${existingText}

${codingRules}
${
  isSpreadsheet
    ? `\nThis document is a spreadsheet, serialized as text tables. Each table is headed "## Sheet: <name>"; the first column is the real spreadsheet row number and the "| row | A | B | C | ..." header gives the column letters. On every data point set source_sheet to the sheet name and source_cell to the exact cell or range you read the value from (e.g. 'B4' or 'C4:N4'); quote the cell's text in source_excerpt.\n`
    : ""
}
Read the whole document, then call propose_extraction exactly once with every quantitative metric you find. Use "${job.filename}" as the source_file on each data point.`;

  const input: AgentInputItem[] = [
    {
      role: "user",
      content: [fileBlock, { type: "input_text", text: instruction }],
    },
  ];

  let proposal: ExtractionProposal | null = null;
  const onExtraction = (p: ExtractionProposal) => {
    proposal = p;
  };

  const tools = createAgentTools(framework, { onExtraction });

  try {
    await runAgentStreaming({
      model: "gpt-4.1",
      instructions: getSystemPrompt(framework, "extract"),
      tools,
      input,
      maxTurns: 8,
      framework,
      emit,
    });
  } catch (err) {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!proposal) {
    emit("error", { message: "Model did not call propose_extraction." });
    return;
  }
  emit("proposal", proposal);
  emit("done", {});
}
