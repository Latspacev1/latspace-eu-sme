// Re-embed the prebuilt RAG indexes with OpenAI embeddings.
//
// The chunk *text* and the BM25 sparse index are embedding-model-agnostic, so we
// don't need the original source PDFs to migrate: we read each framework's
// existing agent-runner/data/rag/<fw>/chunks.json, re-embed every chunk's `text`
// with OpenAI's text-embedding-3-large, and rewrite vectors.json (new dense
// vectors + model tag, same BM25) and meta.json (new embedModel). This lets us
// migrate both the cdp and vsme indexes even though only the vsme source PDF is
// in-repo.
//
// The runtime loader (agent-runner/lib/retrieval.ts) asserts vectors.json.model
// === "text-embedding-3-large", so it will refuse to serve an index until this
// has been run.
//
// Usage:
//   OPENAI_API_KEY=... node scripts/reembed-rag-index.mjs            # all frameworks
//   OPENAI_API_KEY=... node scripts/reembed-rag-index.mjs vsme       # one framework
//   node scripts/reembed-rag-index.mjs --dry-run                     # no API calls

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// Load .env.local into process.env (same precedence Next.js uses).
for (const envFile of [".env.local", ".env"]) {
  const p = join(REPO_ROOT, envFile);
  if (!existsSync(p)) continue;
  for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const EMBED_MODEL = "text-embedding-3-large";
const BATCH_SIZE = 64; // OpenAI accepts large batches; chunk counts are small.
// text-embedding-3-large caps a single input at 8192 tokens. We don't ship a
// tokenizer, so we bound by characters: ~3.3 chars/token for dense regulatory
// text, so 24000 chars (~7200 tokens) clears the limit with margin. Voyage's
// limit was higher, so a few legacy CDP chunks exceed this — we mean-pool the
// embeddings of their windows so the full chunk's semantics survive in one
// vector (the full text is still what the model sees via chunks.json).
const MAX_EMBED_CHARS = 24000;
const DRY_RUN = process.argv.includes("--dry-run");
const ALL_FRAMEWORKS = ["cdp", "vsme"];

const requested = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const frameworks = requested.length ? requested : ALL_FRAMEWORKS;

const RAG_DIR = join(REPO_ROOT, "agent-runner", "data", "rag");

if (!DRY_RUN && !process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY env var is required (or pass --dry-run)");
  process.exit(1);
}

/** Strip lone surrogates / control bytes the embedding API rejects with a 400. */
function sanitize(s) {
  let out = s.normalize("NFC");
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  out = out.replace(/\p{Zs}/gu, " ");
  return out.trim();
}

let openai = null;
function getOpenAI() {
  if (openai) return openai;
  const OpenAI = require("openai").default ?? require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

async function embedBatch(input) {
  const client = getOpenAI();
  let attempt = 0;
  while (true) {
    try {
      const resp = await client.embeddings.create({ input, model: EMBED_MODEL });
      const vecs = (resp.data ?? []).map((d) => d.embedding);
      if (vecs.length !== input.length) {
        throw new Error(`OpenAI returned ${vecs.length} embeddings for batch of ${input.length}`);
      }
      return vecs;
    } catch (err) {
      attempt++;
      if (attempt > 3) throw err;
      const wait = attempt * 2000;
      console.warn(`  embed batch failed (attempt ${attempt}): ${err?.message ?? err}; retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** Split a too-long string into <=MAX_EMBED_CHARS windows on whitespace. */
function windowText(text) {
  const windows = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + MAX_EMBED_CHARS, text.length);
    if (end < text.length) {
      // Back up to the last whitespace so we don't split mid-token.
      const ws = text.lastIndexOf(" ", end);
      if (ws > i + MAX_EMBED_CHARS * 0.5) end = ws;
    }
    windows.push(text.slice(i, end));
    i = end;
  }
  return windows;
}

/** Mean-pool a list of equal-length vectors into one. */
function meanPool(vecs) {
  const dim = vecs[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vecs) for (let d = 0; d < dim; d++) out[d] += v[d];
  for (let d = 0; d < dim; d++) out[d] /= vecs.length;
  return out;
}

/** Embed one over-long chunk by windowing + mean-pooling. */
async function embedLongChunk(text, idx) {
  const windows = windowText(text);
  console.log(`    chunk ${idx} is ${text.length} chars → ${windows.length} windows, mean-pooled`);
  const vecs = await embedBatch(windows);
  return meanPool(vecs);
}

async function reembedFramework(framework) {
  const dir = join(RAG_DIR, framework);
  const chunksPath = join(dir, "chunks.json");
  const vectorsPath = join(dir, "vectors.json");
  const metaPath = join(dir, "meta.json");

  if (!existsSync(chunksPath) || !existsSync(vectorsPath)) {
    console.error(`  [${framework}] missing chunks.json or vectors.json in ${dir} — skipping`);
    return;
  }

  const chunks = JSON.parse(readFileSync(chunksPath, "utf8"));
  const vectorsFile = JSON.parse(readFileSync(vectorsPath, "utf8"));
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};

  console.log(`[${framework}] ${chunks.length} chunks, current model=${vectorsFile.model}`);

  if (DRY_RUN) {
    console.log(`  [dry-run] would re-embed ${chunks.length} chunks with ${EMBED_MODEL}; BM25 preserved`);
    return;
  }

  // Embed in original order. Over-long chunks (rare; legacy CDP) are mean-pooled
  // individually; the rest are batched. vectors[i] always maps to chunks[i].
  const texts = chunks.map((c) => sanitize(c.text));
  const vectors = new Array(chunks.length);
  let pending = []; // [{ idx, text }] under the char cap, flushed in batches
  const longCount = texts.filter((t) => t.length > MAX_EMBED_CHARS).length;
  if (longCount) console.log(`  ${longCount} over-long chunk(s) will be windowed + mean-pooled`);

  async function flushPending() {
    if (!pending.length) return;
    const batchVecs = await embedBatch(pending.map((p) => p.text));
    pending.forEach((p, j) => { vectors[p.idx] = batchVecs[j]; });
    pending = [];
  }

  for (let i = 0; i < texts.length; i++) {
    if (texts[i].length > MAX_EMBED_CHARS) {
      await flushPending();
      vectors[i] = await embedLongChunk(texts[i], i);
    } else {
      pending.push({ idx: i, text: texts[i] });
      if (pending.length >= BATCH_SIZE) await flushPending();
    }
    if ((i + 1) % BATCH_SIZE === 0 || i === texts.length - 1) {
      console.log(`  embedded ${i + 1}/${texts.length}`);
    }
  }
  await flushPending();

  if (vectors.length !== chunks.length) {
    throw new Error(`[${framework}] vector count ${vectors.length} != chunk count ${chunks.length}`);
  }
  const missing = vectors.findIndex((v) => !Array.isArray(v) || v.length === 0);
  if (missing !== -1) {
    throw new Error(`[${framework}] chunk ${missing} produced no embedding`);
  }

  // Preserve the existing BM25 index verbatim — it's tokenization-only and does
  // not depend on the embedding model.
  writeFileSync(
    vectorsPath,
    JSON.stringify({ model: EMBED_MODEL, vectors, bm25: vectorsFile.bm25 }, null, 0),
    "utf8",
  );

  writeFileSync(
    metaPath,
    JSON.stringify(
      { ...meta, embedModel: EMBED_MODEL, reembeddedAt: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`  [${framework}] wrote ${vectors.length} vectors (dim=${vectors[0]?.length ?? 0}) → vectors.json, meta.json`);
}

for (const fw of frameworks) {
  await reembedFramework(fw);
}
console.log("\nDone.");
