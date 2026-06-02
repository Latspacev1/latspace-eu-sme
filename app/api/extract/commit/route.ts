// POST /api/extract/commit
// Body: { documentId?: string, proposal: ExtractionProposal }
//
// Persists a user-reviewed extraction proposal into the org-scoped schema:
// resolve/insert the period, upsert parameters, upsert data points (the
// data_points_mark_stale trigger fires), optionally insert formulas, and mark
// the extraction_documents row committed.

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import { isAllowedSection } from "@/lib/metrics/param-sections";

export const runtime = "nodejs";

interface ProposedParameter {
  code: string;
  display_name: string;
  unit: string;
  category: "input" | "emission_factor" | "output";
  section: string;
  is_monthly: boolean;
  is_calculated: boolean;
}

interface ProposedDataPoint {
  parameter_code: string;
  value_annual: number | null;
  values_monthly: (number | null)[] | null;
  source_file?: string;
  source_excerpt?: string;
  source_page?: number;
}

interface ProposedFormula {
  output_param_code: string;
  expression: string;
  expression_human?: string | null;
  dependencies?: string[];
  description?: string | null;
}

interface ExtractionProposal {
  period: { code: string; label: string; start_date?: string; end_date?: string };
  parameters: ProposedParameter[];
  data_points: ProposedDataPoint[];
  formulas?: ProposedFormula[];
  notes?: string;
}

interface CommitBody {
  documentId?: string;
  proposal: ExtractionProposal;
}

export async function POST(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });

  let body: CommitBody;
  try {
    body = (await req.json()) as CommitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const proposal = body.proposal;
  if (!proposal?.period?.code || !Array.isArray(proposal.parameters) || !Array.isArray(proposal.data_points)) {
    return NextResponse.json({ error: "proposal.period, proposal.parameters and proposal.data_points are required" }, { status: 400 });
  }

  // Validate sections up front.
  for (const p of proposal.parameters) {
    if (!isAllowedSection(p.section)) {
      return NextResponse.json({ error: `Unknown section "${p.section}" on parameter "${p.code}"` }, { status: 400 });
    }
  }

  const supabase = getSupabaseServiceClient();

  // 1. Resolve or insert the reporting period (org-scoped).
  const { data: period, error: periodErr } = await supabase
    .from("reporting_periods")
    .upsert(
      {
        org_id: orgId,
        code: proposal.period.code,
        label: proposal.period.label || proposal.period.code,
        start_date: proposal.period.start_date ?? `${new Date().getFullYear()}-01-01`,
        end_date: proposal.period.end_date ?? `${new Date().getFullYear()}-12-31`,
      },
      { onConflict: "org_id,code" },
    )
    .select("id, code, label")
    .single();
  if (periodErr || !period) {
    return NextResponse.json({ error: `Period upsert failed: ${periodErr?.message}` }, { status: 500 });
  }

  // 2. Upsert parameters (dedup on org_id,code).
  if (proposal.parameters.length) {
    const rows = proposal.parameters.map((p, i) => ({
      org_id: orgId,
      code: p.code,
      display_name: p.display_name || p.code,
      unit: p.unit ?? "",
      category: p.category,
      section: p.section,
      is_monthly: !!p.is_monthly,
      is_calculated: !!p.is_calculated,
      display_order: i,
    }));
    const { error } = await supabase.from("parameters").upsert(rows, { onConflict: "org_id,code" });
    if (error) return NextResponse.json({ error: `Parameter upsert failed: ${error.message}` }, { status: 500 });
  }

  // 3. Resolve every code → parameter id (proposed + pre-existing).
  const { data: paramRows, error: paramErr } = await supabase
    .from("parameters")
    .select("id, code")
    .eq("org_id", orgId);
  if (paramErr) return NextResponse.json({ error: paramErr.message }, { status: 500 });
  const idByCode = new Map<string, string>((paramRows ?? []).map((p) => [p.code, p.id]));

  // 4. Upsert data points (trigger marks dependent metrics stale).
  const unknownCodes: string[] = [];
  const dpRows = proposal.data_points
    .map((d) => {
      const parameter_id = idByCode.get(d.parameter_code);
      if (!parameter_id) {
        unknownCodes.push(d.parameter_code);
        return null;
      }
      return {
        org_id: orgId,
        period_id: period.id,
        parameter_id,
        value_annual: d.value_annual,
        values_monthly: d.values_monthly,
        source_file: d.source_file ?? null,
        notes: d.source_excerpt ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (unknownCodes.length) {
    return NextResponse.json(
      { error: `Data points reference unknown parameter codes: ${[...new Set(unknownCodes)].join(", ")}` },
      { status: 400 },
    );
  }

  let dataPointCount = 0;
  if (dpRows.length) {
    const { error } = await supabase
      .from("data_points")
      .upsert(dpRows, { onConflict: "org_id,period_id,parameter_id" });
    if (error) return NextResponse.json({ error: `Data point upsert failed: ${error.message}` }, { status: 500 });
    dataPointCount = dpRows.length;
  }

  // 5. Optional formulas for calculated output parameters.
  let formulaCount = 0;
  if (proposal.formulas?.length) {
    const fRows = proposal.formulas
      .map((f) => {
        const output_param_id = idByCode.get(f.output_param_code);
        if (!output_param_id) return null;
        return {
          org_id: orgId,
          output_param_id,
          expression: f.expression,
          expression_human: f.expression_human ?? null,
          dependencies: f.dependencies ?? [],
          description: f.description ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (fRows.length) {
      const { error } = await supabase.from("formulas").insert(fRows);
      if (error) return NextResponse.json({ error: `Formula insert failed: ${error.message}` }, { status: 500 });
      formulaCount = fRows.length;
    }
  }

  // 6. Mark the document committed.
  if (body.documentId) {
    await supabase
      .from("extraction_documents")
      .update({ status: "committed", period_id: period.id, proposal })
      .eq("id", body.documentId)
      .eq("org_id", orgId);
  }

  return NextResponse.json({
    period: { code: period.code, label: period.label },
    parameters: proposal.parameters.length,
    data_points: dataPointCount,
    formulas: formulaCount,
  });
}
