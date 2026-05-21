// Tiny arithmetic expression evaluator for ChainCraft VSME formulas.
// Grammar:
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := number | identifier | '(' expr ')' | '-' factor
//
// Identifiers resolve via the `inputs` map. Missing keys evaluate to 0
// (matches Excel's behaviour for empty cells in arithmetic).

export type ParamValues = Record<string, number | null | undefined>;

export interface EvaluationResult {
  value: number;
  trace: {
    inputs: Record<string, number>;
    expression: string;
  };
}

type Token =
  | { type: "num"; value: number }
  | { type: "id"; name: string }
  | { type: "op"; op: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ type: "rparen" }); i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ type: "op", op: c });
      i++; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: "num", value: Number(input.slice(i, j)) });
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++;
      tokens.push({ type: "id", name: input.slice(i, j) });
      i = j; continue;
    }
    throw new Error(`Unexpected character '${c}' at position ${i} in "${input}"`);
  }
  return tokens;
}

export function evaluate(expression: string, inputs: ParamValues): EvaluationResult {
  const tokens = tokenize(expression);
  let pos = 0;
  const used: Record<string, number> = {};

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseAdditive(): number {
    let left = parseMultiplicative();
    while (peek()?.type === "op" && ((peek() as { op: string }).op === "+" || (peek() as { op: string }).op === "-")) {
      const op = (consume() as { op: string }).op;
      const right = parseMultiplicative();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  function parseMultiplicative(): number {
    let left = parseUnary();
    while (peek()?.type === "op" && ((peek() as { op: string }).op === "*" || (peek() as { op: string }).op === "/")) {
      const op = (consume() as { op: string }).op;
      const right = parseUnary();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }
  function parseUnary(): number {
    const t = peek();
    if (t?.type === "op" && t.op === "-") {
      consume();
      return -parseUnary();
    }
    if (t?.type === "op" && t.op === "+") {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    const t = consume();
    if (!t) throw new Error(`Unexpected end of expression in "${expression}"`);
    if (t.type === "num") return t.value;
    if (t.type === "id") {
      const raw = inputs[t.name];
      const num = raw == null || Number.isNaN(Number(raw)) ? 0 : Number(raw);
      used[t.name] = num;
      return num;
    }
    if (t.type === "lparen") {
      const v = parseAdditive();
      const r = consume();
      if (!r || r.type !== "rparen") throw new Error(`Expected ')' in "${expression}"`);
      return v;
    }
    throw new Error(`Unexpected token ${JSON.stringify(t)} in "${expression}"`);
  }

  pos = 0;
  const value = parseAdditive();
  if (pos !== tokens.length) {
    throw new Error(`Unexpected trailing tokens in "${expression}"`);
  }
  return { value, trace: { inputs: used, expression } };
}

// Topological sort: orders formulas so each one's dependencies are computed first.
// Inputs:
//   formulas: array of { code, expression, dependencies }
//   inputCodes: set of codes that are *not* produced by formulas (raw data points
//               + emission factors). These are leaves in the dep graph.
// Returns formulas in evaluation order. Throws on cycles.
export function topoSortFormulas<T extends { code: string; dependencies: string[] }>(
  formulas: T[],
  inputCodes: Set<string>,
): T[] {
  const byCode = new Map(formulas.map(f => [f.code, f]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: T[] = [];

  function visit(code: string, path: string[]) {
    if (visited.has(code)) return;
    if (visiting.has(code)) {
      throw new Error(`Formula dependency cycle: ${[...path, code].join(" → ")}`);
    }
    const formula = byCode.get(code);
    if (!formula) {
      // It's an input (or an unknown identifier — treat as input/leaf)
      return;
    }
    visiting.add(code);
    for (const dep of formula.dependencies) {
      if (!inputCodes.has(dep)) visit(dep, [...path, code]);
    }
    visiting.delete(code);
    visited.add(code);
    ordered.push(formula);
  }

  for (const f of formulas) visit(f.code, []);
  return ordered;
}
