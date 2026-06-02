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
import type { ExtractJob, EmitFn } from "./types.ts";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

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

  // Fetch the document bytes from the short-TTL signed URL and base64-encode
  // them for the content block. We never receive the service key — only the URL.
  let base64: string;
  try {
    const res = await fetch(job.documentUrl);
    if (!res.ok) {
      emit("error", { message: `Failed to fetch document (${res.status})` });
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    base64 = buf.toString("base64");
  } catch (err) {
    emit("error", { message: `Could not download document: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }

  const isImage = IMAGE_TYPES.has(mime);
  const fileBlock = isImage
    ? { type: "image" as const, source: { type: "base64" as const, media_type: mime, data: base64 } }
    : { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf", data: base64 } };

  const existingText =
    job.existingParameters && job.existingParameters.length
      ? `Existing parameters for this organization — reuse these exact codes when a metric matches, do not create duplicates:\n${job.existingParameters
          .map((p) => `- ${p.code} | ${p.display_name} | ${p.unit} | ${p.section}`)
          .join("\n")}`
      : "This organization has no parameters yet — propose fresh codes.";

  const instruction = `The uploaded document is "${job.filename}".${
    job.periodHint ? ` The user suggests it covers period "${job.periodHint}".` : ""
  }

${existingText}

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
      model: "claude-opus-4-7",
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
