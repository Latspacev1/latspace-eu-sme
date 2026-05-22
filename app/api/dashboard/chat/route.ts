// POST /api/dashboard/chat
//
// Stream-of-events endpoint for the AI Dashboard chat. Accepts the full
// message history (the client owns the thread state), runs Claude with the
// `render_chart` tool, validates and hydrates any tool call, and streams
// back a sequence of newline-delimited JSON events:
//
//   { "type": "text",  "text": "..." }     incremental assistant text
//   { "type": "chart", "spec": {...}, "data": {...} }   on successful render
//   { "type": "error", "message": "..." }  on a recoverable user-facing error
//   { "type": "done" }                     final event
//
// We use ndjson rather than the SSE event format because the client doesn't
// need named events and ndjson is trivial to parse incrementally.

import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient, DASHBOARD_MODEL } from "@/lib/ai/anthropic";
import { RENDER_CHART_TOOL } from "@/lib/ai/tools";
import { loadCatalogue, catalogueToPrompt } from "@/lib/dashboard/catalogue";
import { ChartSpecSchema } from "@/lib/dashboard/chart-spec";
import { validateSpec } from "@/lib/dashboard/validate-spec";
import { fetchChartData } from "@/lib/dashboard/fetch-chart-data";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

const SYSTEM_BASE = [
  "You are the chart-generation assistant for the LatSpace VSME sustainability dashboard.",
  "Your job: turn the user's natural-language request into one chart by calling the `render_chart` tool, using ONLY parameter codes from the catalogue below.",
  "",
  "Rules:",
  "- Always prefer `render_chart` when the user wants to see, plot, compare, or visualise data.",
  "- Use the catalogue exactly. Never invent a parameter code; never guess at codes that are not listed.",
  "- If the user's request doesn't map to any catalogued parameter, reply in plain text explaining what's missing. Suggest the 1-3 closest available parameters by display name.",
  "- Default to the period flagged (current) when no period is named.",
  "- Choose `granularity: \"monthly\"` for trend/stacked, `\"annual\"` for kpi/pie or single-period comparisons.",
  "- Choose `kind` thoughtfully:",
  "    * kpi = a headline number card. PREFER this when the user asks 'what is X', 'how much X', 'show me X' for a single metric — e.g. 'renewable share', 'total scope 1', 'GHG intensity'. Also good for 2-4 single-number comparisons.",
  "    * trend = line over time. Use when the user says 'through the year', 'monthly', 'over time'.",
  "    * bar = ranking a few related metrics in one period.",
  "    * stacked = breaking a total into parts across months.",
  "    * pie = share of a total — only for 2-6 mutually exclusive parts.",
  "- A request like 'what's our scope 1' is a KPI, not a trend. A request like 'show scope 1 through the year' is a trend.",
  "- Keep titles short and human ('Scope 1 emissions, FY2025'), not verbose.",
  "- One chart per response. If the user wants two charts, ask which one to do first.",
].join("\n");

function ndjsonEncoder() {
  const encoder = new TextEncoder();
  return (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages[] required" }), { status: 400 });
  }

  const catalogue = await loadCatalogue();
  const cataloguePrompt = catalogueToPrompt(catalogue);

  // Two system blocks so the heavy catalogue text benefits from prompt
  // caching while the (rarely changing) instruction block also stays warm.
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
    { type: "text", text: cataloguePrompt, cache_control: { type: "ephemeral" } },
  ];

  const messages: Anthropic.Messages.MessageParam[] = body.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const enc = ndjsonEncoder();
  const client = getAnthropicClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc(obj));
      try {
        const result = await client.messages.stream({
          model: DASHBOARD_MODEL,
          max_tokens: 1024,
          system: systemBlocks,
          tools: [RENDER_CHART_TOOL],
          tool_choice: { type: "auto" },
          messages,
        });

        // Stream text deltas to the client as they arrive.
        result.on("text", (delta) => {
          if (delta) send({ type: "text", text: delta });
        });

        const final = await result.finalMessage();

        // Find a tool_use block (render_chart). If none, we already streamed
        // the assistant's text reply — just close.
        const toolUse = final.content.find(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "render_chart",
        );

        if (toolUse) {
          const parsed = ChartSpecSchema.safeParse(toolUse.input);
          if (!parsed.success) {
            send({
              type: "error",
              message: "I tried to build a chart but the spec was malformed. Could you rephrase?",
            });
          } else {
            const verdict = validateSpec(parsed.data, catalogue);
            if (!verdict.ok) {
              send({ type: "error", message: verdict.reason });
            } else {
              try {
                const data = await fetchChartData(parsed.data);
                send({ type: "chart", spec: parsed.data, data });
              } catch (err) {
                send({
                  type: "error",
                  message: `Couldn't load chart data: ${(err as Error).message}`,
                });
              }
            }
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        try {
          send({ type: "error", message: (err as Error).message ?? "Unknown error" });
          send({ type: "done" });
        } catch { /* controller may already be closed */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
