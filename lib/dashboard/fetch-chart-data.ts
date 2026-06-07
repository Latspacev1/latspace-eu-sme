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
// Robustness notes (these guard against the "chart is blank even though data
// was entered" class of bugs):
//   - We classify a series as calculated by `is_calculated`, NOT by `category`.
//     An extracted parameter can carry category:"output" while still being a
//     raw input; routing on category sent those to v_current_metrics (which is
//     empty until a recalc runs) and they came back null. is_calculated is the
//     property that actually decides whether a formula produces the value.
//   - A calculated series with no row in v_current_metrics (e.g. recalc hasn't
//     run yet) falls back to reading data_points directly, so a value that was
//     entered is still surfaced.
//   - If a MONTHLY chart is requested but none of the requested series have any
//     monthly data, we transparently fall back to the ANNUAL shape (one point
//     per series labelled with the period code) rather than returning 12 empty
//     months. The renderer paints that as a single-period chart.
//
// To keep this file focused, the monthly calculated series re-uses the same
// topo-sort + evaluator pass the /api/metrics/timeseries route uses.

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { evaluate, topoSortFormulas } from "@/lib/metrics/evaluator";
import type { Parameter, DataPoint, Formula, CurrentMetricRow } from "@/lib/supabase/types";
import type { ChartSpec, ChartData, ChartSeries, ChartSeriesPoint } from "@/lib/dashboard/chart-spec";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A series is "calculated" — i.e. its value comes from a formula, not a raw
// data point — when the parameter is flagged is_calculated. We deliberately do
// NOT use category here (see file header).
function isCalculated(p: Parameter): boolean {
  return !!p.is_calculated;
}

export async function fetchChartData(orgId: string, spec: ChartSpec): Promise<ChartData> {
  const supabase = getSupabaseServiceClient();

  const { data: period, error: pErr } = await supabase
    .from("reporting_periods")
    .select("id, code, label")
    .eq("org_id", orgId)
    .eq("code", spec.period_code)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!period) throw new Error(`Period ${spec.period_code} not found`);
  // Bind a non-null alias so the buildAnnual closure keeps the narrowing.
  const periodRow = period;

  // Pull all parameters once — we need code → metadata + id lookup for
  // both monthly and annual paths.
  const { data: parameters, error: paramsErr } = await supabase
    .from("parameters")
    .select("*")
    .eq("org_id", orgId)
    .order("display_order");
  if (paramsErr) throw new Error(paramsErr.message);

  const paramByCode = new Map<string, Parameter>((parameters as Parameter[]).map(p => [p.code, p]));

  // ── Annual builder ───────────────────────────────────────────────────────
  // Used both for an annual request and as the fallback when a monthly request
  // has no monthly data anywhere. Reads the calculated value from
  // v_current_metrics, and falls back to data_points.value_annual when the view
  // has no row (recalc not yet run, or the param is really a raw input).
  async function buildAnnual(): Promise<ChartData> {
    const series = await Promise.all(spec.parameter_codes.map(async (code) => {
      const param = paramByCode.get(code);
      if (!param) return null;

      let value: number | null = null;

      if (isCalculated(param)) {
        const { data: row } = await supabase
          .from("v_current_metrics")
          .select("value")
          .eq("org_id", orgId)
          .eq("period_id", periodRow.id)
          .eq("parameter_code", code)
          .maybeSingle<CurrentMetricRow>();
        value = row?.value != null ? Number(row.value) : null;
      }

      // Raw input, OR a calculated param with no computed row yet: read the
      // entered data point. Also derive annual from monthly if only the monthly
      // breakdown was entered (sum of present months).
      if (value == null) {
        const { data: dp } = await supabase
          .from("data_points")
          .select("value_annual, values_monthly")
          .eq("org_id", orgId)
          .eq("period_id", periodRow.id)
          .eq("parameter_id", param.id)
          .maybeSingle<Pick<DataPoint, "value_annual" | "values_monthly">>();
        if (dp?.value_annual != null) {
          value = Number(dp.value_annual);
        } else if (dp?.values_monthly && dp.values_monthly.some(v => v != null)) {
          value = dp.values_monthly.reduce<number>((acc, v) => acc + (v != null ? Number(v) : 0), 0);
        }
      }

      const points: ChartSeriesPoint[] = [{ label: periodRow.code, value }];
      const out: ChartSeries = { code, display_name: param.display_name, unit: param.unit, points };
      return out;
    }));
    return {
      period_label: periodRow.label,
      series: series.filter((s): s is ChartSeries => !!s),
    };
  }

  if (spec.granularity === "annual") {
    return buildAnnual();
  }

  // ── Monthly path ─────────────────────────────────────────────────────
  // Re-implement the slimmed-down evaluator pass that timeseries route uses,
  // but only compute the series we need.
  const [{ data: dataPoints }, { data: formulas }] = await Promise.all([
    supabase.from("data_points").select("*").eq("org_id", orgId).eq("period_id", period.id),
    supabase.from("formulas").select("*").eq("org_id", orgId).eq("is_active", true),
  ]);

  const dpByParam = new Map<string, DataPoint>((dataPoints as DataPoint[] ?? []).map(d => [d.parameter_id, d]));
  const paramById = new Map<string, Parameter>((parameters as Parameter[]).map(p => [p.id, p]));

  const annual: Record<string, number> = {};
  for (const p of parameters as Parameter[]) {
    if (isCalculated(p)) continue;
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

  // Build the monthly series, tracking whether ANY requested series actually
  // carried monthly data. If none did, fall back to the annual shape so the
  // chart paints a single-period view instead of 12 empty months.
  const series: ChartSeries[] = [];
  let anyMonthlyData = false;
  for (const code of spec.parameter_codes) {
    const param = paramByCode.get(code);
    if (!param) continue;
    let arr: (number | null)[] | undefined;
    if (isCalculated(param)) {
      arr = monthlyOutputs[code];
    } else if (param.is_monthly) {
      arr = monthlyInputs[code];
    }
    if (arr && arr.some(v => v != null)) anyMonthlyData = true;
    const points: ChartSeriesPoint[] = MONTHS.map((label, i) => ({
      label,
      value: arr?.[i] != null ? Number(arr[i]) : null,
    }));
    series.push({ code, display_name: param.display_name, unit: param.unit, points });
  }

  if (!anyMonthlyData) {
    // No monthly breakdown for any requested series — degrade to the annual
    // view so an entered annual value still surfaces (caveat #2/#3).
    return buildAnnual();
  }

  return { period_label: period.label, series };
}
