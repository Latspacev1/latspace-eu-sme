// Extract mode handler. Mirrors write.ts (same query options, same NDJSON event
// loop) but instead of a report outline it attaches the uploaded document as a
// native document/image content block so Claude can read both the text and the
// page images (handles scanned bills with no separate OCR step), and it
// registers the propose_extraction MCP tool instead of propose_insert.

import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  createAgentMcpServer,
  toolProposeExtraction,
  type ExtractionProposal,
} from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import { spreadsheetToText } from "../lib/spreadsheet/toText.ts";
import type { ExtractJob, EmitFn } from "./types.ts";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

// Spreadsheet uploads can't be sent as a native document/image vision block, so
// we serialize them to a coordinate-preserving text block instead (see
// lib/spreadsheet/toText.ts).
const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

function normalizeMime(mime: string): string {
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

export async function handleExtract(job: ExtractJob, emit: EmitFn): Promise<void> {
  if (!job.documentUrl) {
    emit("error", { message: "documentUrl is required" });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const mime = normalizeMime(job.mimeType || "application/pdf");

  // Fetch the document bytes from the short-TTL signed URL. We never receive the
  // service key — only the URL. For PDFs/images we base64-encode the bytes into a
  // native vision block; for spreadsheets we serialize to a text block instead
  // (Claude vision blocks don't accept .xlsx/.csv), so base64 is skipped there.
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

  let fileBlock:
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

  if (isSpreadsheet) {
    try {
      const sheetText = await spreadsheetToText(buf, mime, job.filename);
      fileBlock = { type: "text" as const, text: sheetText };
    } catch (err) {
      emit("error", { message: `Could not read spreadsheet: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
  } else if (isImage) {
    const base64 = buf.toString("base64");
    fileBlock = { type: "image" as const, source: { type: "base64" as const, media_type: mime, data: base64 } };
  } else {
    const base64 = buf.toString("base64");
    fileBlock = { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf", data: base64 } };
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

  async function* once(): AsyncIterable<SDKUserMessage> {
    yield {
      type: "user",
      message: {
        role: "user",
        content: [fileBlock, { type: "text", text: instruction }],
      } as MessageParam,
      parent_tool_use_id: null,
    };
  }

  const abortController = new AbortController();

  let proposal: ExtractionProposal | null = null;
  const onExtraction = (p: ExtractionProposal) => {
    proposal = p;
  };

  const mcpServer = createAgentMcpServer(framework, { onExtraction });

  const q = query({
    prompt: once(),
    options: {
      model: "claude-sonnet-4-5",
      systemPrompt: getSystemPrompt(framework, "extract"),
      mcpServers: { [framework]: mcpServer },
      allowedTools: [toolProposeExtraction(framework)],
      settingSources: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      includePartialMessages: false,
      maxTurns: 8,
      abortController,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `${framework}-extract/1.0` },
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
          emit("error", { message: "Model did not call propose_extraction." });
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
