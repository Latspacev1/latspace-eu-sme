// GET /api/reporting/output-parameters?period=FY2025&framework=vsme
//
// Returns the registry of output parameters consumed by the Requirements tab
// inside each report editor. Each row carries:
//   - Identity (code, display_name, unit, section, vsme_cell)
//   - Live value + stale flag from v_current_metrics for the active period
//   - The active formula that produced it + trace.inputs from calculated_metrics
//   - `used_in`: which questions in the requested framework reference this
//     parameter, derived at runtime from vsmeExport/map.ts (for VSME) or a
//     manual usage registry (for CDP — empty for now).
//
// Service-role client used for the same reason as /api/chaincraft/metrics —
// app auth is a custom JWT, not Supabase Auth, so RLS would see no rows.

import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import type {
  CalculatedMetric,
  CurrentMetricRow,
  Formula,
  Parameter,
} from "@/lib/supabase/types";
import { vsmeUsageForCell } from "@/lib/reporting/vsmeUsage";

export const runtime = "nodejs";

type SupportedFramework = "vsme" | "cdp";

interface UsedIn {
  framework_id: SupportedFramework;
  framework_name: string;
  question_id: string;
  question_label: string;
  section_id: string;
  section_title: string;
}

interface RequirementRow {
  code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string | null;
  is_calculated: boolean;
  is_monthly: boolean;
  value: number | null;
  is_stale: boolean;
  computed_at: string | null;
  formula: {
    id: string;
    expression: string;
    expression_human: string | null;
    dependencies: string[];
    description: string | null;
  } | null;
  inputs_used: Record<string, number> | null;
  used_in: UsedIn[];
}

function resolveUsage(framework: SupportedFramework, param: Parameter): UsedIn[] {
  if (framework === "vsme") {
    const hit = vsmeUsageForCell(param.vsme_cell);
    if (!hit) return [];
    return [
      {
        framework_id: "vsme",
        framework_name: "VSME Digital Template",
        question_id: hit.questionId,
        question_label: hit.questionLabel,
        section_id: hit.sectionId,
        section_title: hit.sectionTitle,
      },
    ];
  }
  // CDP usage registry — empty for v1. Wire up `lib/reporting/cdpUsage.ts`
  // and resolve here when CDP gets its parameter pinning.
  return [];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get("period");
  const orgId = resolveOrgId(req);
  const frameworkParam = (searchParams.get("framework") ?? "vsme").toLowerCase();
  if (frameworkParam !== "vsme" && frameworkParam !== "cdp") {
    return NextResponse.json(
      { error: `Unsupported framework: ${frameworkParam}` },
      { status: 400 },
    );
  }
  const framework = frameworkParam as SupportedFramework;

  const supabase = getSupabaseServiceClient();

  // Resolve period within the org. Default to the org's current period instead
  // of a hardcoded fiscal year.
  const periodQuery =
    periodParam && periodParam !== "current"
      ? supabase.from("reporting_periods").select("id, code, label, status").eq("org_id", orgId).eq("code", periodParam).maybeSingle()
      : supabase.from("reporting_periods").select("id, code, label, status").eq("org_id", orgId).eq("is_current", true).maybeSingle();
  const { data: period, error: pErr } = await periodQuery;
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!period) {
    // No data yet for this org — return an empty registry rather than 404 so
    // the Requirements tab renders its empty state.
    return NextResponse.json({ period: null, framework, rows: [] });
  }

  // Pull output parameters, ordered by display_order so the table reads
  // top-to-bottom like the dashboard groups do.
  const { data: paramRows, error: paramErr } = await supabase
    .from("parameters")
    .select("*")
    .eq("org_id", orgId)
    .eq("category", "output")
    .order("display_order");
  if (paramErr) return NextResponse.json({ error: paramErr.message }, { status: 500 });
  const parameters = (paramRows ?? []) as Parameter[];

  // Live values from the view, plus active formulas and the latest trace.
  const paramIds = parameters.map((p) => p.id);
  const [metricsRes, formulasRes, calcRes] = await Promise.all([
    supabase
      .from("v_current_metrics")
      .select("*")
      .eq("org_id", orgId)
      .eq("period_id", period.id),
    supabase
      .from("formulas")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .in("output_param_id", paramIds.length ? paramIds : ["__none__"]),
    supabase
      .from("calculated_metrics")
      .select("parameter_id, formula_id, trace, computed_at, is_stale, value")
      .eq("org_id", orgId)
      .eq("period_id", period.id),
  ]);
  if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 500 });
  if (formulasRes.error) return NextResponse.json({ error: formulasRes.error.message }, { status: 500 });
  if (calcRes.error) return NextResponse.json({ error: calcRes.error.message }, { status: 500 });

  const metricByParamId = new Map<string, CurrentMetricRow>();
  for (const row of (metricsRes.data ?? []) as CurrentMetricRow[]) {
    metricByParamId.set(row.parameter_id, row);
  }
  const formulaByParamId = new Map<string, Formula>();
  for (const f of (formulasRes.data ?? []) as Formula[]) {
    formulaByParamId.set(f.output_param_id, f);
  }
  const calcByParamId = new Map<string, CalculatedMetric>();
  for (const c of (calcRes.data ?? []) as CalculatedMetric[]) {
    calcByParamId.set(c.parameter_id, c);
  }

  const rows: RequirementRow[] = parameters.map((p) => {
    const metric = metricByParamId.get(p.id) ?? null;
    const formula = formulaByParamId.get(p.id) ?? null;
    const calc = calcByParamId.get(p.id) ?? null;
    return {
      code: p.code,
      display_name: p.display_name,
      unit: p.unit,
      section: p.section,
      vsme_cell: p.vsme_cell,
      is_calculated: p.is_calculated,
      is_monthly: p.is_monthly,
      value: metric?.value != null ? Number(metric.value) : null,
      is_stale: metric?.is_stale ?? false,
      computed_at: metric?.computed_at ?? null,
      formula: formula
        ? {
            id: formula.id,
            expression: formula.expression,
            expression_human: formula.expression_human,
            dependencies: formula.dependencies,
            description: formula.description,
          }
        : null,
      inputs_used: calc?.trace?.inputs ?? null,
      used_in: resolveUsage(framework, p),
    };
  });

  return NextResponse.json({
    period: { code: period.code, label: period.label, status: period.status },
    framework,
    rows,
  });
}
