// Build the RAG index for the EFRAG VSME guidance document.
//
// Mirrors the (offline) pipeline used for the CBAM and CDP indexes already in
// agent-runner/data/rag/. Output files are written to:
//   agent-runner/data/rag/vsme/chunks.json
//   agent-runner/data/rag/vsme/vectors.json
//   agent-runner/data/rag/vsme/meta.json
//
// The runtime loader (agent-runner/lib/retrieval.ts) consumes the exact shape
// written here. Keep these two files in sync if you change either.
//
// Usage:
//   VOYAGE_API_KEY=... node scripts/build-vsme-index.mjs
//
// Optional env:
//   VSME_PDF_PATH  — path to the source PDF (default: ./vsme_merged.pdf)
//   VSME_TARGET_TOKENS — target chunk size in whitespace tokens (default: 700)
//   VSME_OVERLAP_TOKENS — overlap when splitting large sections (default: 80)

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// Load .env.local into process.env without taking on a dotenv dependency.
// Same precedence Next.js uses: .env.local wins over .env. Quoted values
// are supported but multi-line strings are not.
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

const DRY_RUN = process.argv.includes("--dry-run");

const PDF_PATH = process.env.VSME_PDF_PATH
  ? resolve(REPO_ROOT, process.env.VSME_PDF_PATH)
  : join(REPO_ROOT, "vsme_merged.pdf");

const OUT_DIR = join(REPO_ROOT, "agent-runner", "data", "rag", "vsme");
const TARGET_TOKENS = Number(process.env.VSME_TARGET_TOKENS ?? 700);
const OVERLAP_TOKENS = Number(process.env.VSME_OVERLAP_TOKENS ?? 80);
const EMBED_MODEL = "voyage-3-large";
const BATCH_SIZE = 8;

if (!existsSync(PDF_PATH)) {
  console.error(`PDF not found at ${PDF_PATH}`);
  process.exit(1);
}
if (!DRY_RUN && !process.env.VOYAGE_API_KEY) {
  console.error("VOYAGE_API_KEY env var is required (or pass --dry-run)");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF extraction. We use pdfjs-dist (already in the repo deps) in legacy
//    build mode — it's the one that works under Node without a DOM shim.
//    Each page yields a list of items with x/y/font info; we keep that
//    metadata so we can detect headings vs body text.
// ─────────────────────────────────────────────────────────────────────────────

const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
// pdfjs in Node has no DOM Worker; it dynamically import()s the workerSrc
// string as an ES module instead. Point it at the bundled worker file. Use
// a file:// URL so Windows paths with drive letters work.
{
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("file://" + workerPath.replace(/\\/g, "/")).href;
}

const pdfData = new Uint8Array(readFileSync(PDF_PATH));
const loadingTask = pdfjsLib.getDocument({
  data: pdfData,
  // pdfjs spams the console with font warnings on the EFRAG PDF — suppress.
  verbosity: 0,
  // Don't attempt CMap network fetches.
  disableFontFace: true,
  isEvalSupported: false,
});
const pdfDoc = await loadingTask.promise;
const pageCount = pdfDoc.numPages;
console.log(`Loaded PDF: ${PDF_PATH} (${pageCount} pages)`);

/** @typedef {{ text: string, x: number, y: number, height: number, fontName: string, page: number }} TextItem */

/** @type {TextItem[][]} */
const pages = [];
for (let p = 1; p <= pageCount; p++) {
  const page = await pdfDoc.getPage(p);
  const tc = await page.getTextContent();
  /** @type {TextItem[]} */
  const items = [];
  for (const it of tc.items) {
    // pdfjs gives a transform matrix; index 4 = x, 5 = y, index 3 = vertical scale.
    if (!("str" in it)) continue;
    const str = (it.str || "").replace(/\s+/g, " ");
    if (!str.trim()) continue;
    const tr = it.transform || [1, 0, 0, 1, 0, 0];
    items.push({
      text: str,
      x: tr[4] ?? 0,
      y: tr[5] ?? 0,
      height: Math.abs(tr[3] ?? 0) || it.height || 10,
      fontName: it.fontName || "",
      page: p,
    });
  }
  pages.push(items);
  if (p % 10 === 0) console.log(`  parsed ${p}/${pageCount}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Section detection. VSME structures disclosures as B1..B11 (Basic Module)
//    and C1..C9 (Comprehensive Module), with leading "general" sections
//    (introduction, scope, definitions). We detect headings heuristically by:
//     - Font height noticeably larger than the page's median (visual heading)
//     - OR line content matching a known section pattern (B1, C3, "Annex A",
//       "Disclosure B3", "Module 1", numbered chapters like "3. Scope").
//
//    The heading hierarchy is approximate but only needs to be good enough to
//    give the agent useful section labels in citations. Body chunks always
//    inherit the nearest preceding heading as their sectionTitle / number.
// ─────────────────────────────────────────────────────────────────────────────

// Group raw items into visual lines so we can compare font heights line-by-line.
/** @typedef {{ text: string, height: number, page: number, y: number, items: TextItem[] }} Line */
/** @param {TextItem[]} items @returns {Line[]} */
function groupLines(items) {
  if (!items.length) return [];
  // Sort top-to-bottom (pdfjs y is bottom-up, so high y = top of page) then
  // by x. Then collapse items within a small y-band into the same line.
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  /** @type {Line[]} */
  const lines = [];
  let cur = null;
  for (const it of sorted) {
    if (!cur || Math.abs(cur.y - it.y) > Math.max(2, it.height * 0.4)) {
      if (cur) lines.push(cur);
      cur = { text: it.text, height: it.height, page: it.page, y: it.y, items: [it] };
    } else {
      cur.text += (cur.text.endsWith(" ") || it.text.startsWith(" ") ? "" : " ") + it.text;
      cur.height = Math.max(cur.height, it.height);
      cur.items.push(it);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const allLines = pages.flatMap((items) => groupLines(items));
// Median body font height — anything noticeably taller is a heading candidate.
const heights = allLines.map((l) => l.height).filter((h) => h > 0).sort((a, b) => a - b);
const medianHeight = heights[Math.floor(heights.length / 2)] || 10;
const HEADING_HEIGHT_THRESHOLD = medianHeight * 1.15;

// Section identifier patterns. The first capture group is the "number"
// (e.g. "B3", "C4", "3", "A.1"), the rest of the line is the title.
const SECTION_PATTERNS = [
  // "Disclosure B3 — Energy and greenhouse gas emissions"
  // "Disclosure C4: Climate risks"
  /^\s*Disclosure\s+([BC]\d{1,2})\b[\s:.\-–—]*?(.*)$/i,
  // "B3 Energy and greenhouse gas emissions" (with optional dash)
  /^\s*([BC]\d{1,2})\b[\s:.\-–—]+(.{3,})$/,
  // "Module 1 — General Information"
  /^\s*(Module\s+\d+)\b[\s:.\-–—]+(.+)$/i,
  // "Annex A: Glossary"
  /^\s*(Annex\s+[A-Z])\b[\s:.\-–—]+(.+)$/i,
  // "3. Scope" or "3.1. Reporting boundaries"
  /^\s*(\d+(?:\.\d+){0,3})\.?\s+([A-Z].{2,})$/,
];

/** @param {string} text @returns {{ number: string, title: string } | null} */
function matchHeading(text) {
  const t = text.trim();
  if (!t || t.length > 180) return null;
  for (const re of SECTION_PATTERNS) {
    const m = re.exec(t);
    if (m) {
      const number = (m[1] || "").trim();
      const title = (m[2] || "").trim().replace(/\s+/g, " ");
      if (!number) continue;
      // Skip TOC-style dotted leaders ("..............")
      if (/\.{3,}/.test(title)) continue;
      return { number, title: title || number };
    }
  }
  return null;
}

// Walk every line. For each line: is it a heading? If yes, push it onto a
// stack (depth inferred from numbering shape). Either way, append its text
// to the current section's body, keyed by the active heading stack.

/** @typedef {{ number: string, title: string, depth: number, firstPage: number, lastPage: number, body: string[] }} SectionBucket */

/** @type {SectionBucket[]} */
const sections = [];
/** @type {SectionBucket[]} */
let stack = [];

/** @param {{ number: string, title: string }} h @returns {number} */
function depthOf(h) {
  // Numbered sections like "3.1.2" → depth is the dot count + 1.
  if (/^\d+(?:\.\d+)*$/.test(h.number)) return h.number.split(".").length;
  // Disclosure ids (B1..B11, C1..C9) are level-2 logically; introduce a
  // synthetic level-1 ("Basic Module" / "Comprehensive Module") below.
  if (/^[BC]\d+$/.test(h.number)) return 2;
  if (/^Module\b/i.test(h.number)) return 1;
  if (/^Annex\b/i.test(h.number)) return 1;
  return 2;
}

function ensureModuleParent(h) {
  if (!/^[BC]\d+$/.test(h.number)) return;
  const wantTitle = h.number.startsWith("B") ? "Basic Module" : "Comprehensive Module";
  const wantNumber = h.number.startsWith("B") ? "Basic" : "Comprehensive";
  const top = stack[0];
  if (top && top.title === wantTitle) return;
  // Pop everything; push module parent.
  stack = [];
  const parent = {
    number: wantNumber,
    title: wantTitle,
    depth: 1,
    firstPage: h.firstPage ?? 0,
    lastPage: h.lastPage ?? 0,
    body: [],
  };
  sections.push(parent);
  stack.push(parent);
}

let totalChars = 0;
for (const line of allLines) {
  const isLikelyHeading =
    line.height >= HEADING_HEIGHT_THRESHOLD && line.text.length < 180;
  const matched =
    isLikelyHeading || /^\s*(?:Disclosure\s+)?[BC]\d{1,2}\b/i.test(line.text) ||
    /^\s*(?:Module|Annex)\b/i.test(line.text)
      ? matchHeading(line.text)
      : null;

  if (matched) {
    ensureModuleParent({ ...matched, firstPage: line.page, lastPage: line.page });
    const depth = depthOf(matched);
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const bucket = {
      number: matched.number,
      title: matched.title,
      depth,
      firstPage: line.page,
      lastPage: line.page,
      body: [],
    };
    sections.push(bucket);
    stack.push(bucket);
    continue;
  }

  if (!stack.length) {
    // Pre-first-heading content goes into a synthetic "Front Matter" section.
    const front = {
      number: "0",
      title: "Front Matter",
      depth: 1,
      firstPage: line.page,
      lastPage: line.page,
      body: [],
    };
    sections.push(front);
    stack.push(front);
  }
  const cur = stack[stack.length - 1];
  cur.body.push(line.text);
  cur.lastPage = line.page;
  // Also update every ancestor's lastPage so parents span their descendants.
  for (const ancestor of stack) {
    ancestor.lastPage = Math.max(ancestor.lastPage, line.page);
  }
  totalChars += line.text.length + 1;
}

// A "TOC-like" body is mostly dotted leaders and page numbers — those are
// table-of-contents rows the heading regex picked up by mistake. Drop them so
// embeddings aren't wasted on lines like "B3 Energy . . . . . . . . . . 14".
/** @param {string[]} body */
function looksLikeToc(body) {
  const joined = body.join(" ");
  if (joined.length < 40) return true;
  const dotChars = (joined.match(/\./g) ?? []).length;
  // If >25% of the body is dots, it's a TOC leader row.
  if (dotChars / joined.length > 0.25) return true;
  // If average word length is <3 (mostly page numbers and dots), it's TOC.
  const words = joined.split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const avgLen = joined.replace(/\s/g, "").length / words.length;
    if (avgLen < 3) return true;
  }
  return false;
}

const leafSections = sections.filter((s) => s.body.length > 0 && !looksLikeToc(s.body));
console.log(
  `Detected ${sections.length} sections, ${leafSections.length} kept after TOC filter, ${totalChars} chars`
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Chunking. We pack each section into chunks of ~TARGET_TOKENS whitespace
//    tokens. If a section is short, it becomes one chunk. If it's long, we
//    split on sentence boundaries with a small overlap so the embedding has
//    enough context near the seam.
// ─────────────────────────────────────────────────────────────────────────────

/** @param {string} s @returns {string[]} */
function splitSentences(s) {
  // Cheap sentence splitter — good enough for embedding chunking.
  return s
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .filter((t) => t.trim().length > 0);
}

/** @param {string} s @returns {number} */
function tokenCount(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

/** @param {SectionBucket} sec @returns {string[]} */
function chunkSection(sec) {
  const body = sec.body.join(" ").replace(/\s+/g, " ").trim();
  if (!body) return [];
  const sentences = splitSentences(body);
  /** @type {string[]} */
  const chunks = [];
  /** @type {string[]} */
  let buf = [];
  let bufTokens = 0;
  for (const sent of sentences) {
    const st = tokenCount(sent);
    if (bufTokens + st > TARGET_TOKENS && buf.length) {
      chunks.push(buf.join(" "));
      // Overlap — keep the tail sentences for context.
      const tail = [];
      let tailTokens = 0;
      for (let i = buf.length - 1; i >= 0; i--) {
        const t = tokenCount(buf[i]);
        if (tailTokens + t > OVERLAP_TOKENS) break;
        tail.unshift(buf[i]);
        tailTokens += t;
      }
      buf = tail;
      bufTokens = tailTokens;
    }
    buf.push(sent);
    bufTokens += st;
  }
  if (buf.length) chunks.push(buf.join(" "));
  return chunks;
}

/** @typedef {{ sectionNumber: string, sectionTitle: string, sectionPath: string[], firstPage: number, lastPage: number, chunkIndex: number, text: string, context: string }} Chunk */

/** Build the parent-path label for a section by walking back through sections
 * we've seen. Cheap O(n) — the section list is small. */
function pathFor(sec) {
  // Walk left-to-right collecting ancestors of strictly lower depth.
  /** @type {string[]} */
  const path = [];
  let needed = sec.depth - 1;
  for (let i = sections.indexOf(sec) - 1; i >= 0 && needed > 0; i--) {
    if (sections[i].depth === needed) {
      path.unshift(`${sections[i].number} ${sections[i].title}`.trim());
      needed--;
    }
  }
  return path;
}

/** @type {Chunk[]} */
const chunks = [];
for (const sec of leafSections) {
  const pieces = chunkSection(sec);
  const path = pathFor(sec);
  for (const piece of pieces) {
    const idx = chunks.length;
    // Pack a small structured prefix into `text` so embeddings carry the
    // section label too. The existing CBAM/CDP indexes also include a short
    // contextual prefix at the top of `text`; we mirror the style.
    const headerLines = [
      `${sec.number} ${sec.title}`.trim(),
      path.length ? `Path: ${path.join(" › ")}` : null,
      `Pages: ${sec.firstPage}-${sec.lastPage}`,
    ].filter(Boolean);
    const text = headerLines.join("\n") + "\n\n" + piece;
    chunks.push({
      sectionNumber: sec.number,
      sectionTitle: sec.title,
      sectionPath: path,
      firstPage: sec.firstPage,
      lastPage: sec.lastPage,
      chunkIndex: idx,
      text,
      context: "",
    });
  }
}

console.log(`Built ${chunks.length} chunks (target ${TARGET_TOKENS} tokens each)`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Embeddings. Call the Voyage API in batches, model = voyage-3-large,
//    inputType = "document". 1024-dim vectors; matches the existing
//    CBAM/CDP indexes so cosine fusion at query time is well-defined.
// ─────────────────────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log("\n[dry-run] section summary:");
  const sample = leafSections.slice(0, Math.min(40, leafSections.length));
  for (const s of sample) {
    const preview = s.body.join(" ").slice(0, 80).replace(/\s+/g, " ");
    console.log(
      `  ${s.number.padEnd(8)} ${s.title.slice(0, 60).padEnd(62)} p${s.firstPage}-${s.lastPage}  body=${preview}…`
    );
  }
  if (leafSections.length > sample.length) {
    console.log(`  … and ${leafSections.length - sample.length} more`);
  }
  console.log(`\n[dry-run] would build ${chunks.length} chunks, skipping embeddings`);
  process.exit(0);
}

const { VoyageAIClient } = require("voyageai");
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

/** @param {string} s @returns {string} */
function sanitize(s) {
  let out = s.normalize("NFC");
  // Strip lone surrogates and control bytes the Voyage API rejects.
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  out = out.replace(/\p{Zs}/gu, " ");
  return out.trim();
}

/** @type {number[][]} */
const vectors = [];
for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const slice = chunks.slice(i, i + BATCH_SIZE);
  const input = slice.map((c) => sanitize(c.text));
  let attempt = 0;
  // Up to 3 retries with linear backoff on transient errors.
  while (true) {
    try {
      const resp = await voyage.embed({
        input,
        model: EMBED_MODEL,
        inputType: "document",
      });
      const batchVecs = (resp.data ?? []).map((d) => d.embedding);
      if (batchVecs.length !== slice.length) {
        throw new Error(`Voyage returned ${batchVecs.length} embeddings for batch of ${slice.length}`);
      }
      vectors.push(...batchVecs);
      break;
    } catch (err) {
      attempt++;
      if (attempt > 3) throw err;
      const wait = attempt * 2000;
      console.warn(`  embed batch ${i / BATCH_SIZE} failed (attempt ${attempt}): ${err?.message ?? err}; retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if ((i / BATCH_SIZE) % 5 === 0) console.log(`  embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);
}
console.log(`Got ${vectors.length} vectors, dim=${vectors[0]?.length ?? 0}`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. BM25 index. Same tokenizer + stop words as agent-runner/lib/retrieval.ts,
//    so the runtime gets identical tokenization on the query side.
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have he in is it its of on or that the to was were will with this these those which there their them they we you your".split(" ")
);

/** @param {string} text @returns {string[]} */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§\.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** @type {Array<{ id: number, length: number, tf: Record<string, number> }>} */
const bm25Docs = [];
/** @type {Record<string, number>} */
const docFreq = {};
let totalLen = 0;
for (let i = 0; i < chunks.length; i++) {
  const tokens = tokenize(chunks[i].text);
  /** @type {Record<string, number>} */
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  for (const t of Object.keys(tf)) docFreq[t] = (docFreq[t] ?? 0) + 1;
  bm25Docs.push({ id: i, length: tokens.length, tf });
  totalLen += tokens.length;
}
const N = chunks.length;
/** @type {Record<string, number>} */
const idf = {};
for (const [term, df] of Object.entries(docFreq)) {
  // BM25+ idf: log((N - df + 0.5) / (df + 0.5) + 1). Always > 0.
  idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
}
const avgLen = N > 0 ? totalLen / N : 0;

// ─────────────────────────────────────────────────────────────────────────────
// 6. Write outputs. Three files matching the runtime's expected shape.
// ─────────────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "chunks.json"), JSON.stringify(chunks, null, 2), "utf8");
writeFileSync(
  join(OUT_DIR, "vectors.json"),
  JSON.stringify(
    {
      model: EMBED_MODEL,
      vectors,
      bm25: { avgLen, idf, docs: bm25Docs },
    },
    null,
    0
  ),
  "utf8"
);
writeFileSync(
  join(OUT_DIR, "meta.json"),
  JSON.stringify(
    {
      framework: "vsme",
      pdfPath: PDF_PATH,
      builtAt: new Date().toISOString(),
      embedModel: EMBED_MODEL,
      contextualizerModel: null,
      contextualRetrieval: false,
      chunkCount: chunks.length,
      leafSectionCount: leafSections.length,
      pageCount,
      firstBodyPage: 1,
      targetTokens: TARGET_TOKENS,
      overlapTokens: OVERLAP_TOKENS,
    },
    null,
    2
  ),
  "utf8"
);

console.log(`\nWrote ${chunks.length} chunks + vectors to ${OUT_DIR}`);
console.log(`  chunks.json`);
console.log(`  vectors.json`);
console.log(`  meta.json`);
