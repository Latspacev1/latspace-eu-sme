// Given a validated ChartSpec, hydrate the underlying numeric series from
// Supabase. Used by:
//   - the chat endpoint when returning an inline chart to the user
//   - the GET /api/dashboard/tiles/[id]/data endpoint for pinned tiles
//
// Granularity rules:
//   monthly  → returns 12 points (Jan..Dec) per series
//   annual   → returns 1 point per series labelled with the period code
//
// Sources:
//   - input parameters → data_points.value_annual / values_monthly
//   - calculated parameters → v_current_metrics (annual) or evaluator
//     re-run via the same logic the /timeseries endpoint uses (monthly)
//
// To keep this file focused, monthly calculated series re-use the existing
// /api/chaincraft/timeseries route. We call it server-side via fetch so we
// don't duplicate the topo-sort + evaluator wiring.

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { evaluate, topoSortFormulas } from "@/lib/chaincraft/evaluator";
import type { Parameter, DataPoint, Formula, CurrentMetricRow } from "@/lib/supabase/types";
import type { ChartSpec, ChartData, ChartSeries, ChartSeriesPoint } from "@/lib/dashboard/chart-spec";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function fetchChartData(spec: ChartSpec): Promise<ChartData> {
  const supabase = getSupabaseServiceClient();

  const { data: period, error: pErr } = await supabase
    .from("reporting_periods")
    .select("id, code, label")
    .eq("code", spec.period_code)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!period) throw new Error(`Period ${spec.period_code} not found`);

  // Pull all parameters once — we need code → metadata + id lookup for
  // both monthly and annual paths.
  const { data: parameters, error: paramsErr } = await supabase
    .from("parameters")
    .select("*")
    .order("display_order");
  if (paramsErr) throw new Error(paramsErr.message);

  const paramByCode = new Map<string, Parameter>((parameters as Parameter[]).map(p => [p.code, p]));

  if (spec.granularity === "annual") {
    const series = await Promise.all(spec.parameter_codes.map(async (code) => {
      const param = paramByCode.get(code);
      if (!param) return null;

      let value: number | null = null;
      if (param.category === "output") {
        const { data: row } = await supabase
          .from("v_current_metrics")
          .select("value")
          .eq("period_id", period.id)
          .eq("parameter_code", code)
          .maybeSingle<CurrentMetricRow>();
        value = row?.value != null ? Number(row.value) : null;
      } else {
        const { data: row } = await supabase
          .from("data_points")
          .select("value_annual")
          .eq("period_id", period.id)
          .eq("parameter_id", param.id)
          .maybeSingle();
        value = row?.value_annual != null ? Number(row.value_annual) : null;
      }

      const points: ChartSeriesPoint[] = [{ label: period.code, value }];
      const out: ChartSeries = { code, display_name: param.display_name, unit: param.unit, points };
      return out;
    }));
    return {
      period_label: period.label,
      series: series.filter((s): s is ChartSeries => !!s),
    };
  }

  // ── Monthly path ─────────────────────────────────────────────────────
  // Re-implement the slimmed-down evaluator pass that timeseries route uses,
  // but only compute the series we need.
  const [{ data: dataPoints }, { data: formulas }] = await Promise.all([
    supabase.from("data_points").select("*").eq("period_id", period.id),
    supabase.from("formulas").select("*").eq("is_active", true),
  ]);

  const dpByParam = new Map<string, DataPoint>((dataPoints as DataPoint[] ?? []).map(d => [d.parameter_id, d]));
  const paramById = new Map<string, Parameter>((parameters as Parameter[]).map(p => [p.id, p]));

  const annual: Record<string, number> = {};
  for (const p of parameters as Parameter[]) {
    if (p.category === "output") continue;
    const dp = dpByParam.get(p.id);
    if (dp?.value_annual != null) annual[p.code] = Number(dp.value_annual);
  }
  const monthlyInputs: Record<string, (number | null)[]> = {};
  for (const p of parameters as Parameter[]) {
    if (!p.is_monthly) continue;
    const dp = dpByParam.get(p.id);
    if (dp?.values_monthly && dp.values_monthly.some(v => v != null)) {
      monthlyInputs[p.code] = dp.values_monthly;
    }
  }

  const formulaList = (formulas as Formula[] ?? []).map(f => {
    const out = paramById.get(f.output_param_id);
    if (!out) throw new Error(`formula ${f.id} → unknown output_param`);
    return { ...f, code: out.code };
  });
  const formulaCodes = new Set(formulaList.map(f => f.code));
  const inputCodes = new Set((parameters as Parameter[]).filter(p => !formulaCodes.has(p.code)).map(p => p.code));
  const ordered = topoSortFormulas(formulaList, inputCodes);

  const monthlyOutputs: Record<string, (number | null)[]> = {};
  for (let m = 0; m < 12; m++) {
    const values: Record<string, number> = { ...annual };
    for (const [c, arr] of Object.entries(monthlyInputs)) {
      const v = arr[m];
      values[c] = v == null ? 0 : Number(v);
    }
    for (const [c, arr] of Object.entries(monthlyOutputs)) {
      const v = arr[m];
      if (v != null) values[c] = v;
    }
    for (const f of ordered) {
      const touchesMonthly = f.dependencies.some(d => monthlyInputs[d] !== undefined || monthlyOutputs[d] !== undefined);
      if (!touchesMonthly) continue;
      try {
        const { value } = evaluate(f.expression, values);
        (monthlyOutputs[f.code] ??= Array(12).fill(null))[m] = value;
        values[f.code] = value;
      } catch { /* skip */ }
    }
  }

  const series: ChartSeries[] = [];
  for (const code of spec.parameter_codes) {
    const param = paramByCode.get(code);
    if (!param) continue;
    let arr: (number | null)[] | undefined;
    if (param.category === "output") {
      arr = monthlyOutputs[code];
    } else if (param.is_monthly) {
      arr = monthlyInputs[code];
    }
    const points: ChartSeriesPoint[] = MONTHS.map((label, i) => ({
      label,
      value: arr?.[i] != null ? Number(arr[i]) : null,
    }));
    series.push({ code, display_name: param.display_name, unit: param.unit, points });
  }

  return { period_label: period.label, series };
}
