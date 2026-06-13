# Migration Plan: Anthropic / Claude Agent SDK → OpenAI / OpenAI Agents SDK

**Status:** Implemented & smoke-tested 2026-06-12 (all 5 phases).
**Author:** generated 2026-06-12.

This document is the file-by-file plan to migrate the ESG management app off Anthropic
and onto OpenAI. It covers two distinct LLM layers, RAG re-embedding, deployment/packaging,
and verification.

## Implementation notes (things that differed from the plan)

Two adjustments surfaced during live testing and are reflected in the shipped code:

1. **Agent stream event name is normalized.** `@openai/agents` renames the raw
   Responses delta event from `response.output_text.delta` to
   `output_text_delta` (the original name survives under `providerData.type`).
   `modes/runAgent.ts` matches the normalized name. NB: the *in-process* chat
   route uses the OpenAI SDK directly, where the raw name
   `response.output_text.delta` is correct — both are intentional.
2. **Embedding token limit → windowed mean-pooling.** `text-embedding-3-large`
   caps a single input at 8192 tokens; ~20 legacy CDP chunks (sized for Voyage's
   higher limit) exceed it. `scripts/reembed-rag-index.mjs` splits an over-long
   chunk into ≤24k-char windows, embeds each, and mean-pools into one vector so
   the full chunk's semantics survive (the full text is still what the model
   reads via `chunks.json`; the 1:1 chunk↔vector mapping is preserved).

Live smoke tests passed for: all four agent modes (chat/write/extract/fill incl.
PDF vision), RAG retrieval against the re-embedded indexes, and the three Layer A
routes (chat-stream + function_call, checklist structured output, sculptor
web_search + url_citation extraction).

---

## 0. Decisions (locked)

| Decision | Choice |
|----------|--------|
| In-process route API surface | **OpenAI Responses API** (`openai.responses.*`) |
| Agent-runner agent layer | **`@openai/agents` SDK** (`Agent` + `run(stream:true)`) |
| Agentic-mode model (chat/write/fill) | **`gpt-5`** |
| Extract model (vision) | `gpt-4.1` |
| In-process routes model | `gpt-4.1` (chat may use `gpt-5`) |
| Embeddings | `text-embedding-3-large` (3072-dim) |
| Delivery | Written plan only; no code changes yet |

The **NDJSON wire contract** between server and browser is the seam we preserve in every
phase — the frontend should need ~zero changes.

---

## 1. Current-state inventory

### Layer A — in-process `@anthropic-ai/sdk` (Next.js routes)

| File | What it does | Anthropic surface |
|------|--------------|-------------------|
| `lib/ai/anthropic.ts` | Singleton client + `DASHBOARD_MODEL = "claude-sonnet-4-6"` | `new Anthropic()` |
| `lib/ai/tools.ts` | `RENDER_CHART_TOOL` schema | `Anthropic.Messages.Tool` |
| `app/api/dashboard/chat/route.ts` | Streaming chat, one `render_chart` tool, `tool_choice:auto`, NDJSON to browser | `messages.stream()`, `.on("text")`, `.finalMessage()`, `cache_control` |
| `lib/ai/checklist.ts` | Structured VSME checklist via **forced** tool | `messages.create()`, `tool_choice:{type:"tool"}`, `cache_control` |
| `lib/ai/sculptor.ts` | Company business-context via **hosted web search** + citations | `messages.create()`, `web_search_20250305`, `web_search_tool_result`, citations |
| `app/api/ai-context/sculptor/route.ts` | Wraps `runSculptor`; checks `ANTHROPIC_API_KEY` | env check only |

All three call sites use **`claude-sonnet-4-6`**, `max_tokens` 1024–2048, ephemeral prompt caching.

### Layer B — `@anthropic-ai/claude-agent-sdk` (`agent-runner/` workspace)

Runs **inside a Vercel Sandbox** (prod) or a local child process (dev). Entry `runner.ts`
dispatches to 4 mode handlers. Each uses the `query()` agentic loop with in-process MCP tools.

| File | Surface |
|------|---------|
| `modes/chat.ts` | `query()` loop, opus-4-7, maxTurns 16, search_guidance + WebSearch/WebFetch |
| `modes/write.ts` | `query()` loop, opus-4-7, maxTurns 16, search_guidance + propose_insert |
| `modes/extract.ts` | `query()` loop, **sonnet-4-5**, maxTurns 8, propose_extraction, **PDF/image vision blocks** |
| `modes/fill.ts` | `query()` loop, opus-4-7, maxTurns 24, search_guidance + propose_fill |
| `lib/agent/tools.ts` | `tool()` + `createSdkMcpServer()`, 4 Zod tools |
| `lib/retrieval.ts` | Hybrid dense (**Voyage `voyage-3-large`**) + BM25 + RRF over baked vectors |
| `lib/guidance.ts` | System prompts (model-agnostic text) |
| `lib/spreadsheet/toText.ts` | xlsx/csv → coordinate text (model-agnostic) |
| `data/rag/{cdp,vsme}/*.json` | Pre-built chunks/vectors/meta (Voyage-embedded) |

### Dispatcher / packaging / deploy

| File | Role |
|------|------|
| `lib/dispatcher/index.ts` | local vs sandbox routing via `AGENT_DISPATCH_MODE` |
| `lib/dispatcher/sandbox.ts` | Vercel Sandbox; injects `ANTHROPIC_API_KEY`+`VOYAGE_API_KEY`; net policy allows `api.anthropic.com`, `api.voyageai.com` |
| `lib/dispatcher/local-stub.ts` | child-process runner; same env injection |
| `scripts/build-runner-tarball.mjs` | bundles runner + **linux-x64 native Claude SDK binary** |
| `scripts/build-vsme-index.mjs` | (offline) RAG index build — **uses Voyage** |
| `.env.local.example`, `DEPLOY.md` | env + runbook |

### Env vars to migrate
`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` → **`OPENAI_API_KEY`** (single key).
Unchanged: `AGENT_DISPATCH_MODE`, `AGENT_RUNNER_TARBALL_URL`, `AGENT_RUNNER_SNAPSHOT_ID`.

---

## 2. Dependency changes

**Root `package.json`** — remove `@anthropic-ai/sdk`; add `openai`.
**`agent-runner/package.json`** — remove `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk`,
`@anthropic-ai/claude-agent-sdk-linux-x64` (optionalDep), `voyageai`; add `openai`, `@openai/agents`
(and `@openai/agents-extensions` only if a custom model provider is needed). Keep `zod`.

---

## 3. Phase 1 — Layer A (in-process routes)

### 3.1 `lib/ai/anthropic.ts` → `lib/ai/openai.ts`
```ts
import OpenAI from "openai";
let _client: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  _client = new OpenAI({ apiKey });
  return _client;
}
export const DASHBOARD_MODEL = "gpt-4.1"; // or "gpt-5" for chat
```
Update all importers (`checklist.ts`, `sculptor.ts`, chat route).

### 3.2 `lib/ai/tools.ts` — `render_chart` schema
Anthropic `Tool` (`input_schema`) → OpenAI Responses function tool
(`{ type:"function", name, description, parameters }`). The JSON Schema body is identical;
only the wrapper keys change. Add `strict:true` for reliable structured args.

### 3.3 `app/api/dashboard/chat/route.ts` — streaming chat
- `client.messages.stream({...})` → `client.responses.stream({ model, input, tools, instructions })`.
- System blocks → `instructions` (string). **Drop `cache_control`** — OpenAI auto-caches prompt prefixes; no code needed.
- Event mapping (keep the NDJSON `send()` calls byte-identical):
  - Anthropic `.on("text", delta)` → iterate stream, on `response.output_text.delta` → `send({type:"text", ...})`.
  - `final.content.find(tool_use)` → from the final response, find the `function_call` output item named `render_chart`; parse `arguments`.
  - Same `{type:"chart"}` / `{type:"error"}` / `{type:"done"}` emissions.
- `tool_choice:{type:"auto"}` → `tool_choice:"auto"`.
- Message history: `messages:[{role,content}]` maps directly to Responses `input` items.

### 3.4 `lib/ai/checklist.ts` — forced structured output
Two equivalent options; **prefer structured outputs over a forced tool**:
- Replace `emit_checklist` forced tool with `response_format`/`text.format` =
  `zodTextFormat(schema, "checklist")` (or a JSON schema) and read the parsed object directly.
- Model → `gpt-4.1`. Drop `cache_control`. `max_tokens` → `max_output_tokens: 2048`.

### 3.5 `lib/ai/sculptor.ts` — hosted web search + citations
- `web_search_20250305` tool → Responses hosted tool `{ type: "web_search" }`.
- **Citation extraction changes:** OpenAI returns URL citations as **annotations** on output_text
  items (`annotation.type === "url_citation"`, `annotation.url`), and web-search calls appear as
  `web_search_call` output items. Rewrite the block loop to read `message.output` items:
  collect `output_text` (+ its `annotations[].url`) and dedupe into `sources`.
- Model → `gpt-4.1`. `max_uses:5` → cap via instructions / tool config. Drop `cache_control`.

### 3.6 `app/api/ai-context/sculptor/route.ts`
Change env guard `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`. No other changes.

**Phase 1 is self-contained and frontend-invisible** — good first PR.

---

## 4. Phase 2 — RAG re-embedding (blocks Phase 3)

Embedding spaces are not interchangeable; **all vectors must be rebuilt**.

### 4.1 Offline build script (`scripts/build-vsme-index.mjs` + any CDP equivalent)
- Replace Voyage batch embed with:
  `openai.embeddings.create({ model:"text-embedding-3-large", input: chunks })` (batch, `inputType` n/a).
- Re-emit `data/rag/cdp/*` and `data/rag/vsme/*`:
  - `vectors.json`: set `model:"text-embedding-3-large"`, new `vectors` (3072-dim each).
  - `meta.json`: update `embedModel`, dims.
  - `chunks.json` + BM25 sparse index: **unchanged** (chunking is model-agnostic).

### 4.2 `agent-runner/lib/retrieval.ts`
- Remove `VoyageAIClient` require; add `import OpenAI`.
- `embedQuery()` → `openai.embeddings.create({ model:"text-embedding-3-large", input: sanitizeQuery(q) })`,
  read `.data[0].embedding`.
- Cosine-sim math is dimension-agnostic but **verify** the loaded `vectors.model` matches the query
  model at load time (fail fast on mismatch — prevents querying a stale Voyage index).
- RRF fusion + BM25 path unchanged.

**Validation:** run ~5 representative `search_guidance` queries per framework before/after and eyeball
that the top sections are still sensible. Note: OpenAI embeddings support `dimensions` shortening if
3072 storage is a concern — optional.

---

## 5. Phase 3 — Layer B agent modes (`@openai/agents`)

### 5.1 `lib/agent/tools.ts` — MCP tools → function tools
- Replace `tool()`/`createSdkMcpServer()` from the Claude SDK with `tool()` from `@openai/agents`.
- Each tool's **Zod schema and handler body port nearly verbatim**; the handler returns a string/JSON
  instead of `{content:[{type:"text"}]}`.
- The per-request closure pattern (callbacks `onSearchHit`/`onProposal`/`onExtraction`/`onFill`) stays —
  build the tool array per request so handlers close over callbacks + framework.
- **Tool naming:** drop the `mcp__<framework>__<name>` prefix; use plain names (`search_guidance`, etc.)
  and update each mode's `allowedTools`/agent `tools` accordingly.
- Validation logic (outline-id check, orphaned-code warnings, vsme_cell regex, formula grammar) is reused as-is.

### 5.2 Mode handlers — `query()` loop → `Agent` + `run()`
For each of `chat.ts`, `write.ts`, `extract.ts`, `fill.ts`:

```ts
import { Agent, run } from "@openai/agents";
const agent = new Agent({
  name: `${framework}-${mode}`,
  model: "gpt-5",                       // extract → "gpt-4.1"
  instructions: getSystemPrompt(framework, mode, job.businessContext),
  tools: [searchGuidanceTool, proposeTool, /* + webSearchTool() for chat */],
});
const result = await run(agent, inputItems, { stream: true, maxTurns: 16 /* per mode */ });
for await (const ev of result) { /* map to NDJSON emit() */ }
```

**Event-loop re-mapping (preserve emitted NDJSON exactly):**

| Today (Claude SDK) | OpenAI Agents stream event | Emit |
|--------------------|----------------------------|------|
| assistant `text` block delta | `raw_model_stream_event` / text delta | `emit("text", {text})` |
| assistant `tool_use` block | `run_item_stream_event` tool_call item | `emit("activity", describeToolUse(...))` |
| `search_guidance` result → `onSearchHit` | tool handler callback (unchanged) | `emit("retrieved", ...)` |
| `propose_*` → `onProposal/onExtraction/onFill` | tool handler callback (unchanged) | `emit("proposal", ...)` |
| `result` subtype success + usage/cost | run completion | `emit("done", {stop_reason, usage, cost})` |
| `result` non-success / tool isError | run error / tool error | `emit("error", {message})` |

Keep the "model did not call propose_* → error" guard. `total_cost_usd` has no direct OpenAI
equivalent — compute from token usage or drop the field (frontend shows it if present).

**Per-mode specifics:**
- `chat.ts`: add hosted `webSearchTool()` (replaces SDK WebSearch/WebFetch); `maxTurns:16`.
- `write.ts`: `maxTurns:16`; propose_insert tool only.
- `fill.ts`: `maxTurns:24`; watch GPT reliably emitting one propose_fill call — may need prompt nudge.
- `extract.ts` (vision): replace the Anthropic content blocks:
  - PDF: `{ type:"input_file", filename, file_data: "data:application/pdf;base64,<...>" }` (or upload via Files API and pass `file_id`).
  - Image: `{ type:"input_image", image_url: "data:<mime>;base64,<...>" }`.
  - Spreadsheet → text: unchanged (`spreadsheetToText` + `input_text`).
  - Model `gpt-4.1`, `maxTurns:8`.

### 5.3 `runner.ts`, `modes/types.ts`, `lib/guidance.ts`, `lib/spreadsheet/toText.ts`
No SDK calls — unchanged. (`guidance.ts` prompts may need light tuning for GPT tool-calling reliability.)

---

## 6. Phase 4 — Dispatcher, packaging, deploy

### 6.1 `lib/dispatcher/sandbox.ts`
- Env injection: drop `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`, inject `OPENAI_API_KEY`.
- Network policy `allow`: replace `api.anthropic.com` + `api.voyageai.com` with **`api.openai.com`**
  (keep blob + supabase entries).

### 6.2 `lib/dispatcher/local-stub.ts`
Same env swap (`OPENAI_API_KEY`).

### 6.3 `scripts/build-runner-tarball.mjs` — **simplifies**
- The `@openai/agents` SDK is pure JS — **remove the linux-x64 native binary existence check**
  and the `--os=linux --cpu=x64 --libc=glibc --include=optional` install flags (no native dep).
- Smaller, simpler tarball.

### 6.4 `.env.local.example` + `DEPLOY.md`
Replace the two keys with `OPENAI_API_KEY`; update key-creation steps, the prod env checklist,
the network-policy note, and remove the Claude-SDK-binary packaging note.

---

## 7. Phase 5 — Verification

1. **Phase 1 routes:** dashboard chart renders; checklist returns valid structured JSON; sculptor returns
   business context **with sources** populated.
2. **RAG:** before/after top-k comparison on sample queries per framework.
3. **Agent modes (local dispatch):** run one job per mode end-to-end, confirm each emits the same NDJSON
   event sequence and the proposal commits via the existing app-side validators
   (`/api/extract/commit`, `lib/metrics/commitProposal.ts`, propose_insert).
4. **Sandbox:** one prod-path job through Vercel Sandbox with the new network policy + tarball.
5. Tune `maxTurns` / prompts where GPT under- or over-calls the propose tools.

---

## 8. Risk register

| Risk | Mitigation |
|------|------------|
| Re-embedding shifts retrieval quality | A/B top-k on sample queries (Phase 2 validation) |
| GPT doesn't call `propose_*` exactly once | Prompt nudge + keep the "no proposal → error" guard; consider `tool_choice` forcing on final turn |
| Sculptor citation shape differs (annotations vs blocks) | Rewrite extraction per §3.5; test sources non-empty |
| `total_cost_usd` field disappears | Compute from usage or omit; frontend tolerates absence |
| Stale Voyage index queried with OpenAI embeds | Fail-fast model check in `retrieval.ts` load |
| Responses API streaming event names differ from assumptions | Verify against `@openai/agents` stream docs during impl |

---

## 9. Suggested PR sequence
1. **PR1 — deps + env scaffolding** (`OPENAI_API_KEY`, package.json, .env.example).
2. **PR2 — Phase 1 Layer A** (chat/checklist/sculptor) — frontend-invisible, shippable alone.
3. **PR3 — Phase 2 RAG re-embed** (script + retrieval.ts + regenerated vectors).
4. **PR4 — Phase 3 agent modes** (tools.ts + 4 handlers).
5. **PR5 — Phase 4 dispatcher/packaging/deploy docs.**

Each PR is independently testable; PR4 depends on PR3.
