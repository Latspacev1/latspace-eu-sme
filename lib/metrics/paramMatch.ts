// Deterministic parameter de-duplication.
//
// The extraction agent invents a `code` for every metric it finds. Across
// uploads it drifts — "Total electricity consumption" arrives as
// `electricity_consumption_total_kwh` one month and `electricity_consumption_total`
// the next — which fragments the same real-world metric across two parameter
// rows (each then half-empty in charts and recalc).
//
// This module canonicalizes a proposed code/display-name to a normal form and
// matches it against the org's existing parameters, so the commit path can
// rewrite a duplicate proposal onto the existing code instead of inserting a
// twin. It is deterministic (no API calls): we strip unit suffixes/tokens and
// compare the remaining semantic tokens as an unordered set.

export interface MatchableParameter {
  code: string;
  display_name: string;
  unit: string;
  section?: string;
}

// Unit tokens we routinely see appended to codes/names. Stripped before
// comparison so `..._kwh` and `...` collapse together. Keep lowercase.
const UNIT_TOKENS = new Set([
  "kwh", "mwh", "gwh", "wh",
  "kg", "g", "t", "tonne", "tonnes", "ton", "tons", "mt", "kt",
  "tco2", "tco2e", "co2", "co2e", "ghg",
  "m3", "m³", "l", "litre", "litres", "liter", "liters", "ml", "kl", "megalitres",
  "km", "m", "mi", "miles",
  "kwhr", "mj", "gj", "tj", "btu",
  "pct", "percent", "percentage", "ratio", "share",
  "usd", "eur", "gbp", "inr", "currency",
  "total", "annual", "yearly", "monthly", "avg", "average", "sum",
]);

// Split on punctuation/whitespace into raw tokens. Multi-character unit tokens
// (tco2e, m3, co2) must be recognised as whole tokens, so we do NOT split
// letter↔digit boundaries here.
function rawTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// After unit tokens are removed, split a residual token on letter↔digit
// boundaries so "scope1" and "scope_1" both yield (scope, 1) — the digit is a
// meaningful qualifier (Scope 1 vs Scope 2) we keep, while scope1 vs scope2
// still differ.
function splitAlphaNum(t: string): string[] {
  return t
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
}

// The semantic token SET of a metric: tokenize, drop unit/qualifier noise and
// year-like numbers, dedupe, sort. Order-independent so
// "total electricity consumption" == "electricity consumption total".
export function semanticKey(code: string, displayName?: string): string {
  // Prefer the display name when present — it carries fuller words than a
  // snake_cased code — but fold both so either spelling matches.
  const tokens = [
    ...rawTokens(displayName ?? ""),
    ...rawTokens(code ?? ""),
  ];
  const kept = new Set<string>();
  for (const raw of tokens) {
    // Strip whole-token units BEFORE the alpha/digit split, so tco2e / m3 / co2
    // are recognised intact rather than shattered into tco/2/e.
    if (UNIT_TOKENS.has(raw)) continue;
    for (const t of splitAlphaNum(raw)) {
      if (/^\d{4,}$/.test(t)) continue;     // 4-digit year noise (2024, 2025)
      if (UNIT_TOKENS.has(t)) continue;     // unit token that stood alone
      kept.add(t);
    }
  }
  return [...kept].sort().join(" ");
}

// Units are "compatible" for a merge when neither side commits to a different
// unit. We keep this loose because the chosen strategy is name-first; the unit
// guard only blocks an obvious mismatch (e.g. kWh vs MWh). Returns true when
// units are equal (case-insensitive) or either side is blank.
export function unitsCompatible(a: string, b: string): boolean {
  const x = (a ?? "").trim().toLowerCase();
  const y = (b ?? "").trim().toLowerCase();
  if (!x || !y) return true;
  return x === y;
}

export interface MatchResult {
  /** The existing code to reuse, or null when the proposal is genuinely new. */
  existingCode: string | null;
}

// Find an existing parameter that represents the same metric as `proposed`.
// Matches on the order-independent semantic key. An exact code match always
// wins first (cheap and unambiguous).
export function matchExistingParameter(
  proposed: MatchableParameter,
  existing: MatchableParameter[],
): MatchResult {
  // 1. Exact code reuse — the agent did the right thing.
  const exact = existing.find((e) => e.code === proposed.code);
  if (exact) return { existingCode: exact.code };

  // 2. Semantic-key match (unit-guarded).
  const key = semanticKey(proposed.code, proposed.display_name);
  if (!key) return { existingCode: null };
  for (const e of existing) {
    if (semanticKey(e.code, e.display_name) !== key) continue;
    if (!unitsCompatible(proposed.unit, e.unit)) continue;
    return { existingCode: e.code };
  }
  return { existingCode: null };
}

// Rewrite identifier tokens inside a formula expression using a code map.
// Formula expressions embed parameter codes as identifiers (see
// lib/metrics/evaluator.ts), so when a dependency is canonicalized the
// expression string must change too — otherwise the evaluator resolves a code
// that no longer exists and silently treats it as 0. We replace only whole
// identifier tokens ([A-Za-z_][A-Za-z0-9_]*), never substrings.
export function rewriteExpression(expression: string, map: Map<string, string>): string {
  return expression.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) => map.get(id) ?? id);
}

// Build a rewrite map { proposedCode -> canonicalCode } for a whole proposal.
// Canonical = an existing parameter's code when matched, otherwise the
// proposed code itself. Also dedupes WITHIN the proposal: if two proposed
// parameters share a semantic key, the first one wins and the second is
// rewritten onto it (so a single upload that lists the same metric twice
// doesn't create twins either).
export function buildCanonicalCodeMap(
  proposedParams: MatchableParameter[],
  existing: MatchableParameter[],
): Map<string, string> {
  const map = new Map<string, string>();
  // keyToCanonical tracks both existing params and earlier proposals in this
  // batch, so intra-batch duplicates collapse onto the first occurrence.
  const keyToCanonical = new Map<string, string>();
  for (const e of existing) {
    const k = semanticKey(e.code, e.display_name);
    if (k && !keyToCanonical.has(k)) keyToCanonical.set(k, e.code);
  }

  for (const p of proposedParams) {
    const match = matchExistingParameter(p, existing);
    if (match.existingCode) {
      map.set(p.code, match.existingCode);
      continue;
    }
    const k = semanticKey(p.code, p.display_name);
    if (k && keyToCanonical.has(k) && unitsCompatible(p.unit, "")) {
      // Earlier proposal in this batch already claimed this metric.
      map.set(p.code, keyToCanonical.get(k)!);
      continue;
    }
    // Genuinely new — it becomes its own canonical, and claims the key so a
    // later twin in the same batch folds onto it.
    map.set(p.code, p.code);
    if (k && !keyToCanonical.has(k)) keyToCanonical.set(k, p.code);
  }
  return map;
}
