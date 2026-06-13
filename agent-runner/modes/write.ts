// Write mode handler. Runs the OpenAI Agents SDK agent with search_guidance +
// propose_insert (and hosted web_search) and emits the drafted proposal once the
// agent calls propose_insert. Streams text + activity events as NDJSON.

import { webSearchTool, type AgentInputItem } from "@openai/agents";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  createAgentTools,
  type ProposalBlocks,
  type RetrievedSource,
} from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { runAgentStreaming } from "./runAgent.ts";
import type { OutlineItem, WriteJob, EmitFn } from "./types.ts";

function formatOutline(items: OutlineItem[]): string {
  if (!items.length) return "(empty document — propose insertions with after_block_id = null)";
  return items
    .map((it) => {
      const head = `[${it.id}] ${it.kind}`;
      if (it.kind === "heading") {
        return `${head} (h${it.level ?? 2}): ${it.heading ?? ""}`;
      }
      if (it.preview) return `${head}: ${it.preview}`;
      return head;
    })
    .join("\n");
}

export async function handleWrite(job: WriteJob, emit: EmitFn): Promise<void> {
  if (!job.instruction?.trim()) {
    emit("error", { message: "instruction is required" });
    return;
  }
  if (!Array.isArray(job.outline)) {
    emit("error", { message: "outline is required (array)" });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const outlineText = formatOutline(job.outline);
  const userText = `Here is the current report outline (block ids in brackets — use them as after_block_id values):

<outline>
${outlineText}
</outline>

---

User instruction: ${job.instruction.trim()}

Search the guidance for any regulatory facts you need, then call propose_insert exactly once with the drafted blocks.`;

  const input: AgentInputItem[] = [{ role: "user", content: userText }];

  const outlineIds = new Set(job.outline.map((it) => it.id));
  const allSources: RetrievedSource[] = [];
  const seen = new Set<string>();

  const onSearchHit = (sources: RetrievedSource[]) => {
    const fresh = sources.filter((s) => {
      const key = `${s.section}|${s.pages}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      allSources.push(...fresh);
      emit("retrieved", fresh);
    }
  };

  let proposal: ProposalBlocks | null = null;
  const onProposal = (p: ProposalBlocks) => {
    proposal = p;
  };

  const tools = [
    ...createAgentTools(framework, { onSearchHit, outlineIds, onProposal }),
    webSearchTool(),
  ];

  try {
    await runAgentStreaming({
      model: "gpt-5",
      instructions: getSystemPrompt(framework, "write", job.businessContext),
      tools,
      input,
      // 16 turns. Write tasks sometimes do "search, refine, search again,
      // cross-reference with a web source, then propose, then revise after a
      // tool error" — that's already 6+ turns.
      maxTurns: 16,
      framework,
      emit,
    });
  } catch (err) {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!proposal) {
    emit("error", { message: "Model did not call propose_insert." });
    return;
  }
  const p = proposal as ProposalBlocks;
  emit("proposal", {
    after_block_id: p.after_block_id,
    blocks: p.blocks,
    rationale: p.rationale,
    sources: allSources.map(({ section, title, pages }) => ({ section, title, pages })),
  });
  emit("done", {});
}
