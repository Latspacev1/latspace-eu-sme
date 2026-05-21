// Smoke test for the ChainCraft formula evaluator against real Excel values.
// Loads the seed SQL formulas + the known input values and compares the
// evaluator's outputs against the "Per Final VSME Report" column from the Excel.

import ExcelJS from "exceljs";

// ──────────────────────────────────────────────────────────────────────────
// Inline evaluator (mirror of lib/chaincraft/evaluator.ts — .mjs can't import .ts)
// ──────────────────────────────────────────────────────────────────────────
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ type: "rparen" }); i++; continue; }
    if ("+-*/".includes(c)) { tokens.push({ type: "op", op: c }); i++; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(input[i+1] ?? ""))) {
      let j = i; while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: "num", value: Number(input.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++;
      tokens.push({ type: "id", name: input.slice(i, j) }); i = j; continue;
    }
    throw new Error(`Unexpected '${c}' in "${input}"`);
  }
  return tokens;
}
function evaluate(expression, inputs) {
  const tokens = tokenize(expression);
  let pos = 0; const used = {};
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];
  function parseAdd() {
    let l = parseMul();
    while (peek()?.type === "op" && (peek().op === "+" || peek().op === "-")) {
      const op = consume().op; const r = parseMul(); l = op === "+" ? l + r : l - r;
    }
    return l;
  }
  function parseMul() {
    let l = parseUn();
    while (peek()?.type === "op" && (peek().op === "*" || peek().op === "/")) {
      const op = consume().op; const r = parseUn(); l = op === "*" ? l * r : l / r;
    }
    return l;
  }
  function parseUn() {
    const t = peek();
    if (t?.type === "op" && t.op === "-") { consume(); return -parseUn(); }
    if (t?.type === "op" && t.op === "+") { consume(); return parseUn(); }
    return parsePrim();
  }
  function parsePrim() {
    const t = consume();
    if (t.type === "num") return t.value;
    if (t.type === "id") {
      const v = inputs[t.name];
      const n = v == null ? 0 : Number(v);
      used[t.name] = n;
      return n;
    }
    if (t.type === "lparen") {
      const v = parseAdd(); const r = consume();
      if (r?.type !== "rparen") throw new Error("missing )"); return v;
    }
    throw new Error(`unexpected ${JSON.stringify(t)}`);
  }
  return { value: parseAdd(), trace: { inputs: used, expression } };
}
function topoSort(formulas, inputCodes) {
  const byCode = new Map(formulas.map(f => [f.code, f]));
  const visited = new Set(), visiting = new Set(), ordered = [];
  function visit(code, path) {
    if (visited.has(code)) return;
    if (visiting.has(code)) throw new Error(`cycle: ${[...path, code].join(" -> ")}`);
    const f = byCode.get(code);
    if (!f) return;
    visiting.add(code);
    for (const d of f.dependencies) if (!inputCodes.has(d)) visit(d, [...path, code]);
    visiting.delete(code); visited.add(code); ordered.push(f);
  }
  for (const f of formulas) visit(f.code, []);
  return ordered;
}

// ──────────────────────────────────────────────────────────────────────────
// Test
// ──────────────────────────────────────────────────────────────────────────
const EXCEL = process.argv[2] ?? "C:/Users/ishan/Downloads/Chaincraft/Chaincraft/ChainCraft VSME/ChainCraft_VSME_Input_Output_FY2025.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(EXCEL);

// Re-derive the same row→code maps the generator uses
const { execSync } = await import("node:child_process");
// Easier: just import the generator's code maps inline. For the smoke test, we'll
// regenerate the seed file and parse the formula expressions + input data points out of it.
execSync(`node scripts/generate-chaincraft-seed.mjs --excel "${EXCEL}" --out supabase/seed/chaincraft_fy2025.sql`, { stdio: "inherit" });

import { readFileSync } from "node:fs";
const sql = readFileSync("supabase/seed/chaincraft_fy2025.sql", "utf8");

// Parse data_points
const dpRegex = /\(select id from parameters where code = '([^']+)'\),\s*([\d.eE+-]+|null),/g;
const inputs = {};
for (const m of sql.matchAll(dpRegex)) inputs[m[1]] = m[2] === "null" ? null : Number(m[2]);

// Parse formulas
const fRegex = /\(select id from parameters where code = '([^']+)'\),\s*'((?:[^'\\]|\\.|''|\n)+?)',\s*'([^']*)',\s*ARRAY\[([^\]]*)\]::text\[\]/g;
const formulas = [];
for (const m of sql.matchAll(fRegex)) {
  const deps = [...m[4].matchAll(/'([^']+)'/g)].map(x => x[1]);
  formulas.push({ code: m[1], expression: m[2].replace(/''/g, "'"), dependencies: deps });
}

const inputCodes = new Set(Object.keys(inputs));
const ordered = topoSort(formulas, inputCodes);

// Evaluate
const computed = { ...inputs };
for (const f of ordered) {
  const { value } = evaluate(f.expression, computed);
  computed[f.code] = value;
}

// Compare against Excel's "Per Final VSME Report" column (col F, index 6)
const outputSheet = wb.getWorksheet("Output");
let pass = 0, fail = 0, near = 0;
const fails = [];
outputSheet.eachRow((row, n) => {
  if (n < 6) return;
  const b = row.getCell(2).value;
  const f = row.getCell(6).value;
  if (!b || typeof f !== "number") return;
  const display = typeof b === "object" && b.richText ? b.richText.map(r=>r.text).join("") : String(b);
  // Find by display name match in formulas
  const formula = formulas.find(fm => {
    const m = sql.match(new RegExp(`\\('([^']+)', '${display.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&").replace(/—/g,"—").replace(/'/g, "''")}'`));
    return m && m[1] === fm.code;
  });
  if (!formula) return;
  const got = computed[formula.code];
  if (got == null) return;
  const reported = f;
  const tol = Math.max(Math.abs(reported) * 0.005, 0.001);  // 0.5% tolerance
  if (Math.abs(got - reported) < tol) pass++;
  else if (Math.abs(got - reported) / Math.max(Math.abs(reported), 1) < 0.05) { near++; fails.push({ code: formula.code, got, reported, delta: got - reported }); }
  else { fail++; fails.push({ code: formula.code, got, reported, delta: got - reported }); }
});
console.log(`\nPASS: ${pass}   NEAR (within 5%): ${near}   FAIL: ${fail}`);
if (fails.length) {
  console.log("\nDifferences:");
  for (const x of fails.slice(0, 20)) console.log(`  ${x.code.padEnd(40)} got=${x.got.toFixed(4)}  reported=${x.reported}  Δ=${x.delta.toFixed(4)}`);
}
