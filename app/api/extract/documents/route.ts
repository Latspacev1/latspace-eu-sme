// GET /api/extract/documents
// Lists the org's uploaded extraction documents (newest first) for the upload
// history shown on /corporate/extract. Server-only: service-role client, org
// scoping via resolveOrgId.

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A parameter recorded by a document, surfaced in the upload history. */
export interface RecordedParameter {
  code: string;
  display_name: string;
  unit: string;
  category: string;
  section: string;
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
}

/** Coerce the stored proposal JSONB into the list of recorded parameters. */
function parametersFromProposal(proposal: unknown): RecordedParameter[] {
  if (typeof proposal !== "object" || proposal === null) return [];
  const params = (proposal as { parameters?: unknown }).parameters;
  if (!Array.isArray(params)) return [];
  return params.map((p) => {
    const row = (p ?? {}) as Record<string, unknown>;
    return {
      code: typeof row.code === "string" ? row.code : "",
      display_name:
        typeof row.display_name === "string" ? row.display_name : "",
      unit: typeof row.unit === "string" ? row.unit : "",
      category: typeof row.category === "string" ? row.category : "",
      section: typeof row.section === "string" ? row.section : "",
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
      "id, filename, mime_type, status, created_at, proposal, reporting_periods:period_id(code)",
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
    };
  });

  return NextResponse.json({ documents });
}
