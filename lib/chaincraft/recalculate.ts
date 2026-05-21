// Recalculate all ChainCraft VSME metrics for a given period.
// Loads all parameters/data_points/formulas, topologically sorts, evaluates,
// and writes results (with trace) into calculated_metrics.

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { evaluate, topoSortFormulas, type ParamValues } from "./evaluator";
import type { Parameter, DataPoint, Formula } from "@/lib/supabase/types";

export interface RecalcResult {
  period_code: string;
  formulas_evaluated: number;
  errors: { code: string; message: string }[];
  duration_ms: number;
}

export async function recalculatePeriod(periodCode: string): Promise<RecalcResult> {
  const start = Date.now();
  const supabase = getSupabaseServiceClient();
  const errors: RecalcResult["errors"] = [];

  // 1. Load the period
  const { data: period, error: pErr } = await supabase
    .from("reporting_periods")
    .select("*")
    .eq("code", periodCode)
    .single();
  if (pErr || !period) throw new Error(`No reporting period ${periodCode}: ${pErr?.message}`);

  // 2. Load parameters, data points, active formulas
  const [{ data: parameters }, { data: dataPoints }, { data: formulas }] = await Promise.all([
    supabase.from("parameters").select("*").order("display_order"),
    supabase.from("data_points").select("*").eq("period_id", period.id),
    supabase.from("formulas").select("*").eq("is_active", true),
  ]);
  if (!parameters || !dataPoints || !formulas) {
    throw new Error("Failed to load parameters/data_points/formulas");
  }

  const paramById = new Map<string, Parameter>(parameters.map(p => [p.id, p as Parameter]));
  const dpByParam = new Map<string, DataPoint>(dataPoints.map(d => [d.parameter_id, d as DataPoint]));

  // 3. Seed the values map with raw inputs (annual values from data_points)
  const values: ParamValues = {};
  for (const p of parameters as Parameter[]) {
    if (p.is_calculated && p.category === "output") continue;  // computed below
    const dp = dpByParam.get(p.id);
    if (!dp) continue;
    values[p.code] = dp.value_annual;
  }

  // 4. Topologically sort formulas. Inputs = anything not produced by an active formula.
  const formulaList = (formulas as Formula[]).map(f => {
    const outputParam = paramById.get(f.output_param_id);
    if (!outputParam) throw new Error(`Formula ${f.id} references unknown output_param_id`);
    return { ...f, code: outputParam.code };
  });
  const formulaCodes = new Set(formulaList.map(f => f.code));
  const inputCodes = new Set(
    (parameters as Parameter[])
      .filter(p => !formulaCodes.has(p.code))
      .map(p => p.code),
  );

  let ordered;
  try {
    ordered = topoSortFormulas(formulaList, inputCodes);
  } catch (e) {
    throw new Error(`Dependency cycle detected: ${(e as Error).message}`);
  }

  // 5. Evaluate each formula, write to calculated_metrics
  const upserts: {
    period_id: string;
    parameter_id: string;
    formula_id: string;
    value: number | null;
    trace: { inputs: Record<string, number>; expression: string };
    is_stale: boolean;
    computed_at: string;
  }[] = [];

  const now = new Date().toISOString();
  for (const f of ordered) {
    try {
      const { value, trace } = evaluate(f.expression, values);
      values[f.code] = value;
      upserts.push({
        period_id: period.id,
        parameter_id: f.output_param_id,
        formula_id: f.id,
        value,
        trace,
        is_stale: false,
        computed_at: now,
      });
    } catch (e) {
      errors.push({ code: f.code, message: (e as Error).message });
    }
  }

  // 6. Upsert calculated_metrics
  if (upserts.length) {
    const { error: upErr } = await supabase
      .from("calculated_metrics")
      .upsert(upserts, { onConflict: "period_id,parameter_id" });
    if (upErr) throw new Error(`calculated_metrics upsert failed: ${upErr.message}`);
  }

  return {
    period_code: periodCode,
    formulas_evaluated: upserts.length,
    errors,
    duration_ms: Date.now() - start,
  };
}
