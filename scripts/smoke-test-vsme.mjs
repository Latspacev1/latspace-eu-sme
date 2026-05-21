// Smoke test: load the VSME RAG index from agent-runner/lib/retrieval.ts and
// run a couple of real queries against it. Confirms shape + relevance.
//
// Usage: node scripts/smoke-test-vsme.mjs

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// Load .env.local so VOYAGE_API_KEY is available.
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

// The retrieval module resolves data via process.cwd() + /data/rag/<framework>.
// agent-runner expects to run with cwd=agent-runner, so chdir there first.
process.chdir(join(REPO_ROOT, "agent-runner"));

const { search, indexStats } = await import(
  "file://" + join(REPO_ROOT, "agent-runner/lib/retrieval.ts").replace(/\\/g, "/")
);

const stats = indexStats("vsme");
console.log("VSME index:", stats);

const queries = [
  "What does B3 require for energy and GHG emissions disclosure?",
  "How does an SME report workforce gender breakdown under B8?",
  "Is the Comprehensive Module mandatory or optional?",
  "What counts as a biodiversity sensitive area for B5?",
];

for (const q of queries) {
  console.log(`\n── Query: ${q}`);
  const hits = await search(q, "vsme", { k: 3 });
  for (const h of hits) {
    const pages =
      h.firstPage === h.lastPage ? `p${h.firstPage}` : `p${h.firstPage}-${h.lastPage}`;
    console.log(
      `  §${h.sectionNumber.padEnd(8)} ${h.sectionTitle.slice(0, 50).padEnd(52)} ${pages}  fused=${h.fusedScore.toFixed(4)}`
    );
    const preview = h.text.replace(/\s+/g, " ").slice(0, 180);
    console.log(`    ${preview}…`);
  }
}
