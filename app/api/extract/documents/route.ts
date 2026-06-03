// GET /api/extract/documents
// Lists the org's uploaded extraction documents (newest first) for the upload
// history shown on /corporate/extract. Server-only: service-role client, org
// scoping via resolveOrgId.

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import {
  normalizeClassification,
  type DocumentClassification,
} from "@/lib/types/document-classification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A parameter recorded by a document, surfaced in the upload history. */
export interface RecordedParameter {
  code: string;
  display_name: string;
  unit: string;
  category: string;
  section: string;
  /**
   * The recorded value for this parameter: the annual value when present,
   * otherwise the sum of the 12 monthly values. null when neither is available.
   */
  value: number | null;
}

export interface ExtractionDocumentSummary {
  id: string;
  filename: string;
  mime_type: string;
  status: "pending" | "committed" | "failed";
  created_at: string;
  /** Period code resolved from the linked reporting period, when committed. */
  period_code: string | null;
  /** Parameters this document recorded (from the committed proposal). */
  parameters: RecordedParameter[];
  /** Category/subcategory the agent assigned (or the reviewer overrode). */
  classification: DocumentClassification | null;
}

/** Resolve a single recorded value from a data point (annual, else monthly sum). */
function valueFromDataPoint(dp: Record<string, unknown>): number | null {
  const annual = dp.value_annual;
  if (typeof annual === "number" && Number.isFinite(annual)) return annual;
  const monthly = dp.values_monthly;
  if (Array.isArray(monthly)) {
    const nums = monthly.filter(
      (m): m is number => typeof m === "number" && Number.isFinite(m),
    );
    if (nums.length) return nums.reduce((a, b) => a + b, 0);
  }
  return null;
}

/** Coerce the stored proposal JSONB into the list of recorded parameters. */
function parametersFromProposal(proposal: unknown): RecordedParameter[] {
  if (typeof proposal !== "object" || proposal === null) return [];
  const params = (proposal as { parameters?: unknown }).parameters;
  if (!Array.isArray(params)) return [];

  // Map parameter_code → value from the proposal's data_points.
  const dataPoints = (proposal as { data_points?: unknown }).data_points;
  const valueByCode = new Map<string, number | null>();
  if (Array.isArray(dataPoints)) {
    for (const d of dataPoints) {
      const dp = (d ?? {}) as Record<string, unknown>;
      const code = typeof dp.parameter_code === "string" ? dp.parameter_code : "";
      if (code && !valueByCode.has(code)) {
        valueByCode.set(code, valueFromDataPoint(dp));
      }
    }
  }

  return params.map((p) => {
    const row = (p ?? {}) as Record<string, unknown>;
    const code = typeof row.code === "string" ? row.code : "";
    return {
      code,
      display_name:
        typeof row.display_name === "string" ? row.display_name : "",
      unit: typeof row.unit === "string" ? row.unit : "",
      category: typeof row.category === "string" ? row.category : "",
      section: typeof row.section === "string" ? row.section : "",
      value: valueByCode.has(code) ? valueByCode.get(code)! : null,
    };
  });
}

export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("extraction_documents")
    .select(
      "id, filename, mime_type, status, created_at, proposal, classification, reporting_periods:period_id(code)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const documents: ExtractionDocumentSummary[] = (data ?? []).map((row) => {
    // reporting_periods:period_id may come back as object or one-element array.
    const rel = (row as { reporting_periods?: unknown }).reporting_periods;
    const period = (Array.isArray(rel) ? rel[0] : rel) as
      | { code?: string }
      | null
      | undefined;
    return {
      id: row.id as string,
      filename: row.filename as string,
      mime_type: row.mime_type as string,
      status: row.status as ExtractionDocumentSummary["status"],
      created_at: row.created_at as string,
      period_code: period?.code ?? null,
      parameters: parametersFromProposal(
        (row as { proposal?: unknown }).proposal,
      ),
      // Prefer the dedicated column; fall back to the proposal blob for rows
      // committed before the classification column existed.
      classification:
        normalizeClassification((row as { classification?: unknown }).classification) ??
        normalizeClassification(
          ((row as { proposal?: { classification?: unknown } }).proposal ?? {})
            .classification,
        ),
    };
  });

  return NextResponse.json({ documents });
}
