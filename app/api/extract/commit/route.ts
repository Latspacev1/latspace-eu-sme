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
import { recalculatePeriod } from "@/lib/metrics/recalculate";
import { invalidateCatalogue } from "@/lib/dashboard/catalogue";
import { buildCanonicalCodeMap, rewriteExpression, type MatchableParameter } from "@/lib/metrics/paramMatch";
import {
  normalizeClassification,
  type DocumentClassification,
} from "@/lib/types/document-classification";

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
  classification?: DocumentClassification;
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

  // 1b. Promote the just-committed period to the org's current period. Without
  // this, is_current stays at its `false` default and every "current" lookup
  // (recalculate, /api/metrics, output-parameters) finds no period — the recalc
  // route then fails with "No current reporting period". Clear the flag on the
  // org's other periods first so we never transiently violate the per-org
  // single-current unique index (reporting_periods_only_one_current_per_org).
  {
    const { error: clearErr } = await supabase
      .from("reporting_periods")
      .update({ is_current: false })
      .eq("org_id", orgId)
      .eq("is_current", true)
      .neq("id", period.id);
    if (clearErr) {
      return NextResponse.json({ error: `Failed to clear current period: ${clearErr.message}` }, { status: 500 });
    }
    const { error: setErr } = await supabase
      .from("reporting_periods")
      .update({ is_current: true })
      .eq("id", period.id);
    if (setErr) {
      return NextResponse.json({ error: `Failed to set current period: ${setErr.message}` }, { status: 500 });
    }
  }

  // 1c. Canonicalize codes against the org's existing parameters so the same
  // real-world metric doesn't fragment across drifted codes (e.g.
  // electricity_consumption_total_kwh vs electricity_consumption_total). We
  // build a { proposedCode -> canonicalCode } map and rewrite it through the
  // parameters, data points, and formula dependency lists before any upsert.
  // A proposal that folds onto an existing code is dropped from the upsert set
  // so we keep the established parameter's metadata rather than overwriting it.
  const { data: existingForMatch } = await supabase
    .from("parameters")
    .select("code, display_name, unit, section")
    .eq("org_id", orgId);
  const existingParams = (existingForMatch ?? []) as MatchableParameter[];
  const existingCodeSet = new Set(existingParams.map((e) => e.code));
  const canonicalByCode = buildCanonicalCodeMap(
    proposal.parameters.map((p) => ({
      code: p.code,
      display_name: p.display_name,
      unit: p.unit ?? "",
      section: p.section,
    })),
    existingParams,
  );
  const canon = (code: string): string => canonicalByCode.get(code) ?? code;
  const mergedInto: { from: string; to: string }[] = [];
  for (const [from, to] of canonicalByCode) {
    if (from !== to) mergedInto.push({ from, to });
  }

  // 2. Upsert parameters (dedup on org_id,code). Skip any proposed parameter
  // whose canonical code is an *existing* row — we don't clobber established
  // metadata. A proposed param that's new (canonical === its own code) still
  // upserts; intra-batch twins collapse because they share a canonical code.
  if (proposal.parameters.length) {
    const seen = new Set<string>();
    const rows = proposal.parameters
      .map((p) => {
        const code = canon(p.code);
        if (existingCodeSet.has(code)) return null; // reuse existing row as-is
        if (seen.has(code)) return null;            // twin already queued
        seen.add(code);
        return {
          org_id: orgId,
          code,
          display_name: p.display_name || code,
          unit: p.unit ?? "",
          category: p.category,
          section: p.section,
          is_monthly: !!p.is_monthly,
          is_calculated: !!p.is_calculated,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r, i) => ({ ...r, display_order: i }));
    if (rows.length) {
      const { error } = await supabase.from("parameters").upsert(rows, { onConflict: "org_id,code" });
      if (error) return NextResponse.json({ error: `Parameter upsert failed: ${error.message}` }, { status: 500 });
    }
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
  // Collapse data points by canonical code. If two drifted codes both carry a
  // value for the same metric in one upload, last-write-wins on the canonical
  // parameter (rather than two rows that then violate the per-param upsert key).
  const dpByCanon = new Map<string, (typeof proposal.data_points)[number]>();
  for (const d of proposal.data_points) {
    dpByCanon.set(canon(d.parameter_code), d);
  }
  const dpRows = [...dpByCanon.entries()]
    .map(([code, d]) => {
      const parameter_id = idByCode.get(code);
      if (!parameter_id) {
        unknownCodes.push(code);
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
        const output_param_id = idByCode.get(canon(f.output_param_code));
        if (!output_param_id) return null;
        return {
          org_id: orgId,
          output_param_id,
          // Rewrite codes embedded in the expression onto their canonical form,
          // matching the dependency rewrite below — otherwise the evaluator
          // resolves a de-duplicated code to 0.
          expression: rewriteExpression(f.expression, canonicalByCode),
          expression_human: f.expression_human ?? null,
          dependencies: (f.dependencies ?? []).map(canon),
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

  // 6. Mark the document committed. Persist the (normalized) classification in
  // its own column so the upload history can read it directly; null when the
  // proposal carried no valid classification.
  if (body.documentId) {
    const classification = normalizeClassification(proposal.classification);
    await supabase
      .from("extraction_documents")
      .update({
        status: "committed",
        period_id: period.id,
        proposal,
        classification,
      })
      .eq("id", body.documentId)
      .eq("org_id", orgId);
  }

  // 7. Recalculate the period so calculated outputs land in calculated_metrics
  // (and therefore v_current_metrics). The data_points_mark_stale trigger only
  // flags rows stale — it does NOT compute values — so without this step any
  // calculated parameter stays blank everywhere it's read (dashboard charts,
  // /api/metrics, output-parameters). This mirrors commitFillProposal.
  // Recalc failure must not lose the already-committed data, so we surface it
  // as a soft warning rather than a 500.
  let recalc: { formulas_evaluated: number; errors: { code: string; message: string }[] } | null = null;
  let recalcError: string | null = null;
  try {
    const r = await recalculatePeriod(orgId, period.code);
    recalc = { formulas_evaluated: r.formulas_evaluated, errors: r.errors };
  } catch (e) {
    recalcError = (e as Error).message;
  }

  // 8. New/changed parameters mean the cached dashboard catalogue is stale —
  // drop it so the chart agent can reference freshly added codes immediately.
  invalidateCatalogue(orgId);

  return NextResponse.json({
    period: { code: period.code, label: period.label },
    parameters: proposal.parameters.length,
    data_points: dataPointCount,
    formulas: formulaCount,
    // Codes the de-dup layer folded onto an existing/canonical parameter, so
    // the UI can tell the user "merged X into Y" instead of silently swallowing.
    merged: mergedInto,
    recalc,
    recalc_error: recalcError,
  });
}
