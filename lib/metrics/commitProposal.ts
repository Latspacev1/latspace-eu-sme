// Commits a fill proposal (output parameters + formulas authored by the fill
// agent) into the org-scoped schema, recalculates, and reads back the computed
// values mapped to their VSME question/field so the client can place them.
//
// Mirrors the upsert pattern in app/api/extract/commit/route.ts but adds:
//   - output params are pinned to a vsme_cell and marked is_calculated
//   - formulas are versioned: any existing active formula for an output is
//     deactivated before the new one is inserted (idempotent re-runs)
//   - a topological pre-validation drops cyclic/invalid formulas into `skipped`
//     rather than failing the whole commit
//   - after recalculatePeriod, each computed value is resolved to its
//     {questionId, fieldId} via vsmeUsageForCell for the client to write into
//     the localStorage answers.

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { isAllowedSection } from "@/lib/metrics/param-sections";
import { recalculatePeriod } from "@/lib/metrics/recalculate";
import { evaluate, topoSortFormulas } from "@/lib/metrics/evaluator";
import { vsmeUsageForCell } from "@/lib/reporting/vsmeUsage";
import type { CurrentMetricRow } from "@/lib/supabase/types";

export interface ProposedOutputParameter {
  code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string;
}

export interface ProposedFillFormula {
  output_param_code: string;
  expression: string;
  dependencies: string[];
  expression_human?: string | null;
  description?: string | null;
  confidence?: number;
}

export interface FillProposal {
  period: { code: string; label: string };
  output_parameters: ProposedOutputParameter[];
  formulas: ProposedFillFormula[];
  skipped?: { vsme_cell: string; reason: string }[];
  notes?: string;
}

export interface FillResult {
  code: string;
  display_name: string;
  value: number | null;
  unit: string;
  vsme_cell: string | null;
  question_id: string;
  field_id: string;
  section_id: string;
  confidence?: number;
}

export interface CommitFillResult {
  committed: { parameters: number; formulas: number };
  fills: FillResult[];
  skipped: { vsme_cell: string; reason: string }[];
  recalc: { formulas_evaluated: number; errors: { code: string; message: string }[] };
}

export class CommitError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function commitFillProposal(
  orgId: string,
  periodId: string,
  proposal: FillProposal,
): Promise<CommitFillResult> {
  const supabase = getSupabaseServiceClient();
  const skipped = [...(proposal.skipped ?? [])];

  // 1. Validate sections; drop outputs with an unresolvable vsme_cell.
  const validOutputs: ProposedOutputParameter[] = [];
  for (const p of proposal.output_parameters) {
    if (!isAllowedSection(p.section)) {
      throw new CommitError(`Unknown section "${p.section}" on parameter "${p.code}"`);
    }
    const usage = vsmeUsageForCell(p.vsme_cell);
    if (!usage || !usage.fieldId) {
      skipped.push({ vsme_cell: p.vsme_cell, reason: `Cell does not map to a fillable VSME field (parameter ${p.code})` });
      continue;
    }
    validOutputs.push(p);
  }

  // 2. Pre-validate formulas: drop cyclic/parse-broken ones into `skipped`.
  //    Inputs = every code NOT produced by a proposed formula.
  const outputByCode = new Map(validOutputs.map((p) => [p.code, p]));
  const formulaList = proposal.formulas
    .filter((f) => outputByCode.has(f.output_param_code))
    .map((f) => ({ ...f, code: f.output_param_code }));
  const formulaCodes = new Set(formulaList.map((f) => f.code));
  const inputCodes = new Set<string>();
  for (const f of formulaList) for (const d of f.dependencies) if (!formulaCodes.has(d)) inputCodes.add(d);

  let validFormulas = formulaList;
  try {
    topoSortFormulas(formulaList, inputCodes);
  } catch {
    // A cycle exists — find and drop offenders by validating one at a time.
    validFormulas = [];
    for (const f of formulaList) {
      try {
        topoSortFormulas([...validFormulas, f], inputCodes);
        validFormulas.push(f);
      } catch {
        const out = outputByCode.get(f.code);
        skipped.push({ vsme_cell: out?.vsme_cell ?? f.code, reason: "Formula dependency cycle" });
      }
    }
  }
  // Drop formulas that fail to parse.
  validFormulas = validFormulas.filter((f) => {
    try {
      evaluate(f.expression, {});
      return true;
    } catch (e) {
      const out = outputByCode.get(f.code);
      skipped.push({ vsme_cell: out?.vsme_cell ?? f.code, reason: `Invalid expression: ${(e as Error).message}` });
      return false;
    }
  });

  // Only commit outputs that end up with a surviving formula.
  const keepCodes = new Set(validFormulas.map((f) => f.code));
  const outputsToCommit = validOutputs.filter((p) => keepCodes.has(p.code));

  if (!outputsToCommit.length) {
    // Nothing derivable — still recalc nothing; return early.
    return {
      committed: { parameters: 0, formulas: 0 },
      fills: [],
      skipped,
      recalc: { formulas_evaluated: 0, errors: [] },
    };
  }

  // 3. Upsert output parameters (idempotent on org_id,code).
  const paramRows = outputsToCommit.map((p, i) => ({
    org_id: orgId,
    code: p.code,
    display_name: p.display_name || p.code,
    unit: p.unit ?? "",
    category: "output" as const,
    section: p.section,
    vsme_cell: p.vsme_cell,
    is_monthly: false,
    is_calculated: true,
    display_order: i,
  }));
  {
    const { error } = await supabase.from("parameters").upsert(paramRows, { onConflict: "org_id,code" });
    if (error) throw new CommitError(`Parameter upsert failed: ${error.message}`, 500);
  }

  // 4. Resolve code → id (proposed outputs + their input dependencies).
  const { data: allParams, error: paramErr } = await supabase
    .from("parameters")
    .select("id, code")
    .eq("org_id", orgId);
  if (paramErr) throw new CommitError(paramErr.message, 500);
  const idByCode = new Map<string, string>((allParams ?? []).map((p) => [p.code, p.id]));

  // 5. Versioned formula insert: deactivate the existing active formula for
  //    each output, then insert the new active one.
  let formulaCount = 0;
  for (const f of validFormulas) {
    const outputId = idByCode.get(f.output_param_code);
    if (!outputId) continue;
    const { error: deErr } = await supabase
      .from("formulas")
      .update({ is_active: false })
      .eq("org_id", orgId)
      .eq("output_param_id", outputId)
      .eq("is_active", true);
    if (deErr) throw new CommitError(`Failed to deactivate prior formula for ${f.output_param_code}: ${deErr.message}`, 500);

    const { error: insErr } = await supabase.from("formulas").insert({
      org_id: orgId,
      output_param_id: outputId,
      expression: f.expression,
      expression_human: f.expression_human ?? null,
      dependencies: f.dependencies ?? [],
      description: f.description ?? null,
      is_active: true,
    });
    if (insErr) throw new CommitError(`Formula insert failed for ${f.output_param_code}: ${insErr.message}`, 500);
    formulaCount++;
  }

  // 6. Recalculate the period (evaluates active formulas → calculated_metrics).
  const recalc = await recalculatePeriod(orgId, proposal.period.code);

  // 7. Read back computed values and map each to its VSME question/field.
  const outputIds = outputsToCommit.map((p) => idByCode.get(p.code)).filter((id): id is string => !!id);
  const { data: metrics, error: mErr } = await supabase
    .from("v_current_metrics")
    .select("*")
    .eq("org_id", orgId)
    .eq("period_id", periodId)
    .in("parameter_id", outputIds.length ? outputIds : ["__none__"]);
  if (mErr) throw new CommitError(mErr.message, 500);

  const metricByParamId = new Map<string, CurrentMetricRow>();
  for (const m of (metrics ?? []) as CurrentMetricRow[]) metricByParamId.set(m.parameter_id, m);
  const confByCode = new Map(validFormulas.map((f) => [f.output_param_code, f.confidence]));

  const fills: FillResult[] = [];
  for (const p of outputsToCommit) {
    const id = idByCode.get(p.code);
    const metric = id ? metricByParamId.get(id) : undefined;
    const usage = vsmeUsageForCell(p.vsme_cell);
    if (!usage || !usage.fieldId) continue;
    fills.push({
      code: p.code,
      display_name: p.display_name,
      value: metric?.value != null ? Number(metric.value) : null,
      unit: p.unit,
      vsme_cell: p.vsme_cell,
      question_id: usage.questionId,
      field_id: usage.fieldId,
      section_id: usage.sectionId,
      confidence: confByCode.get(p.code),
    });
  }

  return {
    committed: { parameters: paramRows.length, formulas: formulaCount },
    fills,
    skipped,
    recalc: { formulas_evaluated: recalc.formulas_evaluated, errors: recalc.errors },
  };
}
