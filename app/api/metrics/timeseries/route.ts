// GET /api/metrics/timeseries?period=FY2025
// Returns monthly arrays for the org's period:
//   - every input parameter where is_monthly = true
//   - every output formula derivable from monthly inputs
//
// Computed on demand from parameters/formulas/data_points (cheap). Replaces
// /api/chaincraft/timeseries.

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import { evaluate, topoSortFormulas } from "@/lib/metrics/evaluator";
import type { Parameter, DataPoint, Formula } from "@/lib/supabase/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get("period");
  const orgId = await resolveOrgId(req);
  if (!orgId) return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });

  const supabase = getSupabaseServiceClient();

  const periodQuery =
    periodParam && periodParam !== "current"
      ? supabase.from("reporting_periods").select("*").eq("org_id", orgId).eq("code", periodParam).maybeSingle()
      : supabase.from("reporting_periods").select("*").eq("org_id", orgId).eq("is_current", true).maybeSingle();

  const { data: period, error: pErr } = await periodQuery;
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

  const [{ data: parameters }, { data: dataPoints }, { data: formulas }] = await Promise.all([
    supabase.from("parameters").select("*").eq("org_id", orgId).order("display_order"),
    supabase.from("data_points").select("*").eq("org_id", orgId).eq("period_id", period.id),
    supabase.from("formulas").select("*").eq("org_id", orgId).eq("is_active", true),
  ]);
  if (!parameters || !dataPoints || !formulas) {
    return NextResponse.json({ error: "Failed to load schema" }, { status: 500 });
  }

  const paramById = new Map<string, Parameter>((parameters as Parameter[]).map(p => [p.id, p]));
  const paramByCode = new Map<string, Parameter>((parameters as Parameter[]).map(p => [p.code, p]));
  const dpByParam = new Map<string, DataPoint>((dataPoints as DataPoint[]).map(d => [d.parameter_id, d]));

  // Annual values for every input parameter
  const annual: Record<string, number> = {};
  for (const p of parameters as Parameter[]) {
    if (p.category === "output") continue;
    const dp = dpByParam.get(p.id);
    if (dp?.value_annual != null) annual[p.code] = Number(dp.value_annual);
  }

  // Monthly values per input
  const monthlyInputs: Record<string, (number | null)[]> = {};
  for (const p of parameters as Parameter[]) {
    if (!p.is_monthly) continue;
    const dp = dpByParam.get(p.id);
    if (dp?.values_monthly && dp.values_monthly.some(v => v != null)) {
      monthlyInputs[p.code] = dp.values_monthly;
    }
  }

  const formulaList = (formulas as Formula[]).map(f => {
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
    for (const [code, arr] of Object.entries(monthlyInputs)) {
      const v = arr[m];
      values[code] = v == null ? 0 : Number(v);
    }
    for (const [code, arr] of Object.entries(monthlyOutputs)) {
      const v = arr[m];
      if (v != null) values[code] = v;
    }

    for (const f of ordered) {
      const touchesMonthly = f.dependencies.some(
        d => monthlyInputs[d] !== undefined || monthlyOutputs[d] !== undefined,
      );
      if (!touchesMonthly) continue;

      try {
        const { value } = evaluate(f.expression, values);
        (monthlyOutputs[f.code] ??= Array(12).fill(null))[m] = value;
        values[f.code] = value;
      } catch {
        // skip — formula not evaluatable this month
      }
    }
  }

  const seriesify = (codes: string[], source: Record<string, (number | null)[]>) =>
    codes.flatMap(code => {
      const p = paramByCode.get(code);
      if (!p) return [];
      return [{
        code,
        display_name: p.display_name,
        unit: p.unit,
        section: p.section,
        values: source[code],
      }];
    });

  return NextResponse.json({
    period: { code: period.code, label: period.label },
    months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    inputs: seriesify(Object.keys(monthlyInputs), monthlyInputs),
    outputs: seriesify(Object.keys(monthlyOutputs), monthlyOutputs),
  });
}
