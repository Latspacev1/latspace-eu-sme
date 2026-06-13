// Chat mode handler. Runs the OpenAI Agents SDK agent with the search_guidance
// tool plus the hosted web_search tool, streaming text + activity events to
// stdout as NDJSON via emit().

import { webSearchTool, type AgentInputItem } from "@openai/agents";
import { getSystemPrompt } from "../lib/guidance.ts";
import { createAgentTools, type RetrievedSource } from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { runAgentStreaming } from "./runAgent.ts";
import type { ChatJob, ChatContext, ChatMessage, EmitFn } from "./types.ts";

function formatContext(ctx: ChatContext): string {
  if (ctx.kind === "question") {
    const { question: q, answer: a } = ctx;
    const lines = [
      `You are currently helping the user with question ${q.id} ("${q.label}") in section "${q.sectionTitle}" (${q.sectionId}).`,
      `Question type: ${q.questionKind}.`,
    ];
    if (q.description) lines.push(`Question description: ${q.description}`);
    if (a) {
      lines.push(
        `Current answer status: ${a.status} (${a.filledCount}/${a.totalFields} fields filled).`
      );
      if (a.preview) lines.push(`Current answer preview: ${a.preview}`);
    }
    lines.push(
      "When answering, factor this question's intent into your reply. If the user's question is ambiguous, assume it relates to this question."
    );
    return lines.join("\n");
  }
  const outlineLines = ctx.outline.length
    ? ctx.outline
        .map((it) => {
          const head = `[${it.id}] ${it.kind}`;
          if (it.kind === "heading") return `${head} (h${it.level ?? 2}): ${it.heading ?? ""}`;
          if (it.preview) return `${head}: ${it.preview}`;
          return head;
        })
        .join("\n")
    : "(empty document)";
  return [
    `You are currently helping the user with the document titled "${ctx.title}".`,
    `Here is the full document outline (block ids in brackets):`,
    outlineLines,
    "When answering, factor the document's contents into your reply. If the user references a section by name, locate it in the outline above.",
  ].join("\n");
}

// The Responses input format carries assistant turns natively, so unlike the
// Claude Agent SDK port we no longer fold them into the next user message. The
// optional `context` argument is injected into the *final* user message only,
// since stale context on older turns would confuse the model.
function historyAsInput(
  messages: ChatMessage[],
  context: ChatContext | null | undefined
): AgentInputItem[] {
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  const items: AgentInputItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "assistant") {
      items.push({ role: "assistant", content: m.content });
      continue;
    }
    const parts: string[] = [];
    if (i === lastUserIdx && context) {
      parts.push(`<context>\n${formatContext(context)}\n</context>`);
    }
    parts.push(m.content);
    items.push({ role: "user", content: parts.join("\n\n") });
  }
  return items;
}

export async function handleChat(job: ChatJob, emit: EmitFn): Promise<void> {
  if (!job.messages?.length) {
    emit("error", { message: "messages is required" });
    return;
  }
  const lastUser = [...job.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    emit("error", { message: "No user message" });
    return;
  }

  const framework = resolveRagFramework(job.framework);

  // Source dedupe across multiple search_guidance calls in one turn.
  // Section+pages identifies a chunk well enough for UI purposes.
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

  const tools = [...createAgentTools(framework, { onSearchHit }), webSearchTool()];

  try {
    await runAgentStreaming({
      model: "gpt-5",
      instructions: getSystemPrompt(framework, "chat", job.businessContext),
      tools,
      input: historyAsInput(job.messages, job.context ?? null),
      // 16 turns. Compound regulatory questions sometimes need a long chain —
      // search guidance, refine query, cross-reference an external standard via
      // web search, then synthesize.
      maxTurns: 16,
      framework,
      emit,
    });
    emit("done", {});
  } catch (err) {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
  }
}
